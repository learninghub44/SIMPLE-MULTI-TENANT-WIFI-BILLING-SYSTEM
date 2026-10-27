# Webhook Security Documentation

This document describes webhook security practices for payment and SMS providers in the WiFi Billing System.

## Overview

Webhooks are HTTP callbacks sent by providers to notify the platform about events (payment confirmations, delivery reports, etc.). Securing webhooks is critical to prevent fraud, replay attacks, and unauthorized access.

## Security Principles

1. **Never trust unverified callbacks** - Always verify authenticity
2. **Never grant access based solely on browser redirects** - Use authoritative status checks
3. **Prevent replay attacks** - Track processed callbacks
4. **Validate all data** - Verify amounts, references, and ownership
5. **Log all webhook events** - Maintain an audit trail

## Webhook Verification Methods

### HMAC Signature Verification

Most providers use HMAC (Hash-based Message Authentication Code) signatures to verify webhook authenticity.

#### How It Works

1. Provider generates a signature using a shared secret and the request payload
2. Signature is sent in a header (e.g., `X-Signature`, `X-Hub-Signature`)
3. Platform recalculates the signature using the same secret
4. Platform compares the calculated signature with the received signature
5. If they match, the callback is authentic

#### Implementation

The platform provides utilities for signature verification in `src/integrations/shared/webhook/WebhookSecurity.js`:

```javascript
const { verifyHmacSignature, validateWebhook } = require('../src/integrations/shared/webhook/WebhookSecurity');

// Verify HMAC-SHA256 signature
const isValid = verifyHmacSignature(
  rawRequestBody,  // Raw request body (as string)
  signatureHeader, // Signature from header
  webhookSecret    // Shared secret
);

// Full webhook validation with timestamp check
const validation = validateWebhook({
  payload: rawRequestBody,
  headers: requestHeaders,
  secret: webhookSecret,
  signatureHeader: 'x-signature',
  signaturePrefix: 'sha256=',
  timestampHeader: 'x-timestamp',
  toleranceSeconds: 300,
});

if (!validation.valid) {
  // Reject callback
  return res.status(400).json({ error: validation.reason });
}
```

### Provider-Specific Verification

Some providers use custom verification methods:

#### Daraja M-Pesa

Daraja doesn't use HMAC signatures. Instead, it uses a password-based verification:

```javascript
const { verifyDarajaSignature } = require('../src/integrations/shared/webhook/WebhookSecurity');

const isValid = verifyDarajaSignature(
  callbackPassword,  // Password from callback
  shortcode,         // M-Pesa shortcode
  passkey,           // M-Pesa passkey
  timestamp          // Timestamp from callback
);
```

**Note:** Daraja's verification is limited. The platform should perform additional validation:
- Verify the checkout request ID exists in the database
- Verify the amount matches the expected amount
- Verify the operator ownership

#### PayHero

PayHero doesn't use HMAC signatures. Verification is based on:
- Matching the external reference (transaction ID)
- Validating the amount
- Performing an authoritative status check via PayHero API

## Replay Attack Prevention

Replay attacks occur when an attacker resends a previously valid webhook to duplicate a payment or access grant.

### Prevention Methods

#### 1. Idempotency Keys

Generate unique idempotency keys for each payment request:

```javascript
const { generateIdempotencyKey } = require('../src/integrations/shared/idempotency/IdempotencyManager');

const idempotencyKey = generateIdempotencyKey('payment');
```

#### 2. Processed Callback Tracking

Track processed callbacks using the `IdempotencyManager`:

```javascript
const { isCallbackNew, cleanupExpiredCallbacks } = require('../src/integrations/shared/webhook/WebhookSecurity');

// In-memory store for production, use Redis for distributed systems
const processedCallbacks = new Map();

// Check if callback is new
if (!isCallbackNew(processedCallbacks, callbackId)) {
  logger.warn('Replay attack detected', { callbackId });
  return res.status(200).json({ message: 'Already processed' });
}

// Periodically clean up expired records
setInterval(() => {
  cleanupExpiredCallbacks(processedCallbacks, 86400); // 24 hour TTL
}, 3600000); // Every hour
```

#### 3. Database Constraints

Use database constraints to prevent duplicate payments:

```prisma
model Payment {
  transactionId String @unique
  providerReference String?
  providerCheckoutId String?

  @@unique([provider, providerReference])
  @@unique([provider, providerCheckoutId])
}
```

## Timestamp Validation

Timestamps prevent old callbacks from being replayed:

```javascript
const { isTimestampValid } = require('../src/integrations/shared/webhook/WebhookSecurity');

const timestamp = headers['x-timestamp'];
if (!isTimestampValid(timestamp, 300)) { // 5 minute tolerance
  return res.status(400).json({ error: 'Timestamp is too old or in the future' });
}
```

## Data Validation

Always validate callback data before processing:

### Payment Callbacks

1. **Verify Transaction ID Exists**
   ```javascript
   const payment = await prisma.payment.findUnique({
     where: { transactionId: callback.transactionId }
   });
   if (!payment) {
     return res.status(404).json({ error: 'Transaction not found' });
   }
   ```

2. **Verify Amount Matches**
   ```javascript
   if (Number(callback.amount) !== payment.amount) {
     logger.error('Amount mismatch', { 
       expected: payment.amount, 
       received: callback.amount 
     });
     return res.status(400).json({ error: 'Amount mismatch' });
   }
   ```

3. **Verify Operator Ownership**
   ```javascript
   if (payment.operatorId !== operator.id) {
     logger.error('Operator ownership mismatch', { 
       paymentOperatorId: payment.operatorId,
       requestOperatorId: operator.id 
     });
     return res.status(403).json({ error: 'Operator ownership mismatch' });
   }
   ```

4. **Verify Provider Reference**
   ```javascript
   if (payment.providerReference && payment.providerReference !== callback.reference) {
     return res.status(400).json({ error: 'Provider reference mismatch' });
   }
   ```

### SMS Delivery Callbacks

1. **Verify Message ID Exists**
   ```javascript
   const smsLog = await prisma.smsLog.findUnique({
     where: { messageId: callback.messageId }
   });
   if (!smsLog) {
     return res.status(404).json({ error: 'Message not found' });
   }
   ```

2. **Verify Operator Ownership**
   ```javascript
   if (smsLog.operatorId !== operator.id) {
     return res.status(403).json({ error: 'Operator ownership mismatch' });
   }
   ```

## Authoritative Status Verification

For critical payments, perform an authoritative status check with the provider:

```javascript
const paymentRegistry = require('../src/integrations/payments/index').paymentRegistry;

// Get the provider adapter
const adapter = paymentRegistry.getProvider(payment.provider);

// Check status with provider
const statusResult = await adapter.checkStatus(operatorConfig, payment.providerReference);

if (!statusResult.success || statusResult.status !== 'completed') {
  logger.error('Authoritative status check failed', { statusResult });
  return res.status(202).json({ message: 'Payment not confirmed' });
}
```

## Provider-Specific Security

### Daraja

- **Signature Verification:** Limited (password-based)
- **Idempotency:** Not supported by API
- **Recommendations:**
  - Use platform-level idempotency
  - Perform amount validation
  - Verify transaction ID exists
  - Consider authoritative checks for high-value transactions

### PayHero

- **Signature Verification:** None
- **Idempotency:** Not supported by API
- **Recommendations:**
  - Always perform authoritative status check
  - Validate external reference
  - Validate amount
  - Use platform-level idempotency

### Africa's Talking

- **Signature Verification:** Not documented
- **Recommendations:**
  - Validate message ID
  - Validate operator ownership
  - Use platform-level idempotency for delivery reports

### Twilio

- **Signature Verification:** Supported (X-Twilio-Signature)
- **Recommendations:**
  - Implement signature verification
  - Use Twilio's signature verification library
  - Validate request URL
  - Validate timestamp

## Security Checklist

Before deploying webhook handlers:

- [ ] Implement signature verification (if provider supports it)
- [ ] Implement timestamp validation
- [ ] Implement replay attack prevention
- [ ] Validate all callback data
- [ ] Verify transaction/message ID exists
- [ ] Verify amount matches (for payments)
- [ ] Verify operator ownership
- [ ] Perform authoritative status checks (for critical payments)
- [ ] Log all webhook events
- [ ] Return appropriate HTTP status codes
- [ ] Handle errors gracefully
- [ ] Never expose sensitive data in responses

## Error Handling

### Invalid Signature

```javascript
return res.status(401).json({ 
  error: 'Invalid signature',
  message: 'Webhook signature verification failed' 
});
```

### Replay Attack

```javascript
return res.status(200).json({ 
  message: 'Already processed',
  warning: 'Duplicate callback detected' 
});
```

### Invalid Timestamp

```javascript
return res.status(400).json({ 
  error: 'Invalid timestamp',
  message: 'Callback timestamp is outside acceptable range' 
});
```

### Data Validation Failure

```javascript
return res.status(400).json({ 
  error: 'Validation failed',
  message: 'Callback data validation failed' 
});
```

### Transaction Not Found

```javascript
return res.status(404).json({ 
  error: 'Not found',
  message: 'Transaction not found' 
});
```

## Logging

Log all webhook events for audit purposes:

```javascript
logger.info('Payment callback received', {
  provider: payment.provider,
  transactionId: callback.transactionId,
  amount: callback.amount,
  operatorId: operator.id,
  timestamp: new Date().toISOString(),
});
```

**Important:** Never log sensitive data such as:
- Full API keys or secrets
- Full authorization headers
- Raw credit card details (should never be stored anyway)

## Testing Webhook Security

### Unit Tests

Test signature verification with known valid and invalid signatures:

```javascript
test('should verify valid HMAC signature', () => {
  const payload = '{"test":"data"}';
  const secret = 'test_secret';
  const signature = generateSignature(payload, secret);
  
  const isValid = verifyHmacSignature(payload, signature, secret);
  expect(isValid).toBe(true);
});

test('should reject invalid HMAC signature', () => {
  const payload = '{"test":"data"}';
  const secret = 'test_secret';
  const signature = 'invalid_signature';
  
  const isValid = verifyHmacSignature(payload, signature, secret);
  expect(isValid).toBe(false);
});
```

### Integration Tests

Test webhook handlers with provider sandbox environments:

1. Initiate a test payment
2. Wait for callback
3. Verify signature verification
4. Verify data validation
5. Verify idempotency

### Security Audits

Regularly audit:
- Webhook signature implementation
- Timestamp validation logic
- Replay attack prevention
- Data validation rules
- Error handling
- Logging practices

## Troubleshooting

### Signature Verification Fails

1. Check if the secret matches between platform and provider
2. Verify the signature header name is correct
3. Check if a signature prefix needs to be stripped (e.g., `sha256=`)
4. Verify the request body is not modified by middleware
5. Check encoding (base64 vs hex)

### Replay Attack False Positives

1. Check TTL settings for callback tracking
2. Verify idempotency key generation
3. Check if callbacks are being retried by the provider
4. Verify cleanup interval for expired records

### Timestamp Validation Fails

1. Check system clock synchronization
2. Verify tolerance window is appropriate
3. Check timestamp header name
4. Verify timestamp format (Unix timestamp vs ISO string)

## Best Practices

1. **Always verify signatures** - Never skip signature verification
2. **Use HTTPS** - Always use HTTPS for webhook endpoints
3. **Validate early** - Validate before processing
4. **Fail securely** - Reject invalid requests, don't process them
5. **Log everything** - Maintain comprehensive audit logs
6. **Test thoroughly** - Test with real provider callbacks
7. **Monitor alerts** - Set up alerts for security events
8. **Rotate secrets** - Regularly rotate webhook secrets
9. **Document procedures** - Document security procedures
10. **Review regularly** - Regularly review security practices

## References

- [OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html)
- [HMAC Verification](https://en.wikipedia.org/wiki/HMAC)
- Provider-specific documentation (see PAYMENT_PROVIDERS.md and SMS_PROVIDERS.md)
