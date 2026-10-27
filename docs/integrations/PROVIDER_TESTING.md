# Provider Testing Documentation

This document describes testing procedures for payment and SMS providers in the WiFi Billing System.

## Overview

All providers must be thoroughly tested before production deployment. This includes:
- Unit tests with mocked API responses
- Integration tests with sandbox environments
- End-to-end tests with real transactions
- Security tests for webhook verification
- Performance tests for rate limiting

## Testing Principles

1. **Test in sandbox first** - Never test with production credentials initially
2. **Use small amounts** - Use minimum transaction amounts for testing
3. **Test all scenarios** - Test success, failure, and edge cases
4. **Mock external dependencies** - Use mocks for unit tests
5. **Test idempotency** - Verify duplicate requests are handled correctly
6. **Test webhook security** - Verify signature verification works
7. **Test error handling** - Verify errors are handled gracefully
8. **Document test results** - Keep records of test outcomes

## Payment Provider Testing

### Daraja (M-Pesa) Testing

#### Sandbox Setup

1. **Access Sandbox**
   - URL: https://sandbox.safaricom.co.ke
   - Create a developer account at https://developer.safaricom.co.ke
   - Obtain sandbox credentials:
     - Consumer Key
     - Consumer Secret
     - Shortcode (usually 174379)
     - Passkey

2. **Configure Environment**
   ```env
   MPESA_ENV=sandbox
   MPESA_CONSUMER_KEY=your_sandbox_consumer_key
   MPESA_CONSUMER_SECRET=your_sandbox_consumer_secret
   MPESA_SHORTCODE=174379
   MPESA_PASSKEY=your_sandbox_passkey
   MPESA_CALLBACK_URL=https://your-ngrok-url.com/api/mpesa/callback
   ```

3. **Set Up Callback URL**
   - Use ngrok or similar for local testing
   - Ensure callback URL is publicly accessible
   - Configure in Daraja dashboard

#### Test Cases

**Test 1: STK Push Initiation**
```javascript
test('should initiate STK push successfully', async () => {
  const adapter = new DarajaAdapter();
  const result = await adapter.initiatePayment(
    {
      consumerKey: process.env.MPESA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET,
      shortcode: process.env.MPESA_SHORTCODE,
      passkey: process.env.MPESA_PASSKEY,
    },
    {
      amount: 10, // Minimum amount
      phone: '254700000000', // Test number
      transactionId: 'test_tx_001',
      callbackUrl: process.env.MPESA_CALLBACK_URL,
    }
  );

  expect(result.success).toBe(true);
  expect(result.providerReference).toBeDefined();
  expect(result.checkoutId).toBeDefined();
  expect(result.status).toBe('pending');
});
```

**Test 2: Invalid Phone Number**
```javascript
test('should reject invalid phone number', async () => {
  const adapter = new DarajaAdapter();
  const result = await adapter.initiatePayment(
    { /* credentials */ },
    {
      amount: 10,
      phone: 'invalid_phone',
      transactionId: 'test_tx_002',
      callbackUrl: 'https://example.com/callback',
    }
  );

  expect(result.success).toBe(false);
  expect(result.errorMessage).toContain('Invalid Kenyan phone number');
});
```

**Test 3: Invalid Amount**
```javascript
test('should reject invalid amount', async () => {
  const adapter = new DarajaAdapter();
  const result = await adapter.initiatePayment(
    { /* credentials */ },
    {
      amount: 0,
      phone: '254700000000',
      transactionId: 'test_tx_003',
      callbackUrl: 'https://example.com/callback',
    }
  );

  expect(result.success).toBe(false);
  expect(result.errorMessage).toContain('Amount');
});
```

**Test 4: Callback Processing**
```javascript
test('should process successful callback', async () => {
  const adapter = new DarajaAdapter();
  const callbackBody = {
    Body: {
      stkCallback: {
        MerchantRequestID: 'test-merchant-id',
        CheckoutRequestID: 'ws_CO_210120210123456789',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 10 },
            { Name: 'MpesaReceiptNumber', Value: 'LHA7R5Q9SJ' },
          ],
        },
      },
    },
  };

  const result = await adapter.verifyCallback(
    { /* operator config */ },
    {},
    callbackBody
  );

  expect(result.valid).toBe(true);
  expect(result.status).toBe('completed');
  expect(result.amount).toBe(10);
  expect(result.receipt).toBe('LHA7R5Q9SJ');
});
```

**Test 5: Failed Callback**
```javascript
test('should process failed callback', async () => {
  const adapter = new DarajaAdapter();
  const callbackBody = {
    Body: {
      stkCallback: {
        MerchantRequestID: 'test-merchant-id',
        CheckoutRequestID: 'ws_CO_210120210123456789',
        ResultCode: 1032,
        ResultDesc: 'Request cancelled by user',
      },
    },
  };

  const result = await adapter.verifyCallback(
    { /* operator config */ },
    {},
    callbackBody
  );

  expect(result.valid).toBe(true);
  expect(result.status).toBe('failed');
});
```

#### Manual Testing Procedure

1. **Initiate STK Push**
   - Use the platform's payment initiation endpoint
   - Enter a test phone number (use your own)
   - Enter a small amount (KES 10)
   - Submit the request

2. **Complete Payment on Phone**
   - Enter M-Pesa PIN on your phone
   - Wait for payment completion

3. **Verify Callback Received**
   - Check server logs for callback
   - Verify payment status updated in database
   - Verify Wi-Fi access provisioned

4. **Test Failure Scenarios**
   - Cancel payment on phone
   - Enter wrong PIN
   - Insufficient balance
   - Verify failed status recorded

### PayHero Testing

#### Sandbox Setup

1. **Access Sandbox**
   - Contact PayHero for sandbox access
   - Obtain sandbox credentials:
     - Username
     - Password
     - Channel ID

2. **Configure Environment**
   ```env
   PAYHERO_ENV=sandbox
   PAYHERO_USERNAME=your_sandbox_username
   PAYHERO_PASSWORD=your_sandbox_password
   PAYHERO_CHANNEL_ID=your_sandbox_channel_id
   ```

#### Test Cases

**Test 1: Payment Initiation**
```javascript
test('should initiate PayHero payment successfully', async () => {
  const adapter = new PayHeroAdapter();
  const result = await adapter.initiatePayment(
    {
      username: process.env.PAYHERO_USERNAME,
      password: process.env.PAYHERO_PASSWORD,
      channelId: parseInt(process.env.PAYHERO_CHANNEL_ID),
    },
    {
      amount: 10,
      phone: '254700000000',
      transactionId: 'test_tx_001',
      callbackUrl: 'https://example.com/callback',
    }
  );

  expect(result.success).toBe(true);
  expect(result.providerReference).toBeDefined();
});
```

**Test 2: Status Check**
```javascript
test('should check transaction status', async () => {
  const adapter = new PayHeroAdapter();
  const result = await adapter.checkStatus(
    { /* credentials */ },
    'existing_reference'
  );

  expect(result.success).toBe(true);
  expect(result.status).toBeDefined();
});
```

**Test 3: Callback Processing**
```javascript
test('should process PayHero callback', async () => {
  const adapter = new PayHeroAdapter();
  const callbackBody = {
    response: {
      ExternalReference: 'test_tx_001',
      Status: 'SUCCESS',
      Amount: 10,
      MpesaReceiptNumber: 'ABC123',
    },
  };

  const result = await adapter.verifyCallback(
    { /* operator config */ },
    {},
    callbackBody
  );

  expect(result.valid).toBe(true);
  expect(result.status).toBe('completed');
});
```

#### Manual Testing Procedure

1. **Initiate Payment**
   - Use platform's payment initiation with PayHero
   - Enter test phone number
   - Enter small amount
   - Submit request

2. **Complete Payment**
   - Follow PayHero's payment flow
   - Complete payment on phone

3. **Verify Callback**
   - Check server logs
   - Verify payment status
   - Verify status check API works

## SMS Provider Testing

### Africa's Talking Testing

#### Sandbox Setup

1. **Access Sandbox**
   - URL: https://api.sandbox.africastalking.com/version1
   - Create account at https://account.africastalking.com
   - Obtain sandbox credentials:
     - Username
     - API Key

2. **Configure Environment**
   ```env
   AFRICASTALKING_ENV=sandbox
   AFRICASTALKING_USERNAME=your_sandbox_username
   AFRICASTALKING_API_KEY=your_sandbox_api_key
   ```

#### Test Cases

**Test 1: Send SMS**
```javascript
test('should send SMS successfully', async () => {
  const adapter = new AfricaTalkingAdapter();
  const result = await adapter.sendSms(
    {
      username: process.env.AFRICASTALKING_USERNAME,
      apiKey: process.env.AFRICASTALKING_API_KEY,
    },
    {
      to: '254700000000',
      message: 'Test message from WiFi Billing System',
    }
  );

  expect(result.success).toBe(true);
  expect(result.messageId).toBeDefined();
  expect(result.status).toBe('sent' || 'queued');
});
```

**Test 2: Invalid Phone Number**
```javascript
test('should reject invalid phone number', async () => {
  const adapter = new AfricaTalkingAdapter();
  const result = await adapter.sendSms(
    { /* credentials */ },
    {
      to: 'invalid_phone',
      message: 'Test message',
    }
  );

  expect(result.success).toBe(false);
  expect(result.errorMessage).toContain('phone');
});
```

**Test 3: Balance Check**
```javascript
test('should check account balance', async () => {
  const adapter = new AfricaTalkingAdapter();
  const result = await adapter.checkBalance({
    username: process.env.AFRICASTALKING_USERNAME,
    apiKey: process.env.AFRICASTALKING_API_KEY,
  });

  expect(result.success).toBe(true);
  expect(result.balance).toBeDefined();
  expect(result.currency).toBeDefined();
});
```

**Test 4: Long Message Truncation**
```javascript
test('should truncate long messages', async () => {
  const adapter = new AfricaTalkingAdapter();
  const longMessage = 'A'.repeat(2000);
  
  const truncated = adapter.truncateMessage(longMessage, 160);
  expect(truncated.length).toBeLessThanOrEqual(160);
});
```

#### Manual Testing Procedure

1. **Send Test SMS**
   - Use platform's SMS sending endpoint
   - Enter your phone number
   - Enter test message
   - Send SMS

2. **Verify Receipt**
   - Check phone for SMS
   - Verify message content
   - Note delivery time

3. **Test Delivery Report**
   - Configure delivery callback URL
   - Send another SMS
   - Verify delivery callback received
   - Check delivery status in database

4. **Test Balance Check**
   - Use balance check endpoint
   - Verify balance returned
   - Compare with Africa's Talking dashboard

### Twilio Testing

#### Sandbox Setup

1. **Access Sandbox**
   - URL: https://www.twilio.com/console
   - Create account (free trial available)
   - Obtain test credentials:
     - Account SID
     - Auth Token
   - Purchase a test phone number

2. **Configure Environment**
   ```env
   TWILIO_ACCOUNT_SID=your_test_account_sid
   TWILIO_AUTH_TOKEN=your_test_auth_token
   TWILIO_FROM_NUMBER=your_test_phone_number
   ```

#### Test Cases

**Test 1: Send SMS**
```javascript
test('should send SMS via Twilio', async () => {
  const adapter = new TwilioAdapter();
  const result = await adapter.sendSms(
    {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    },
    {
      to: '+254700000000',
      message: 'Test message from Twilio',
      senderId: process.env.TWILIO_FROM_NUMBER,
    }
  );

  expect(result.success).toBe(true);
  expect(result.messageId).toBeDefined();
});
```

**Test 2: Balance Check**
```javascript
test('should check Twilio balance', async () => {
  const adapter = new TwilioAdapter();
  const result = await adapter.checkBalance({
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
  });

  expect(result.success).toBe(true);
  expect(result.balance).toBeDefined();
});
```

**Test 3: Delivery Report Processing**
```javascript
test('should process Twilio delivery report', async () => {
  const adapter = new TwilioAdapter();
  const callbackBody = {
    MessageSid: 'SM1234567890',
    MessageStatus: 'delivered',
    Timestamp: '2026-10-21T10:00:00Z',
  };

  const result = await adapter.processDeliveryReport(
    { /* operator config */ },
    {},
    callbackBody
  );

  expect(result.messageId).toBe('SM1234567890');
  expect(result.status).toBe('delivered');
});
```

#### Manual Testing Procedure

1. **Send Test SMS**
   - Use platform's SMS sending with Twilio
   - Enter verified phone number
   - Send test message

2. **Verify Receipt**
   - Check phone for SMS
   - Verify message content
   - Check Twilio console for logs

3. **Test Delivery Reports**
   - Configure callback URL in Twilio
   - Send SMS
   - Verify delivery callback received

4. **Test Error Scenarios**
   - Send to invalid number
   - Send empty message
   - Use invalid sender ID
   - Verify error handling

## Security Testing

### Webhook Signature Verification

**Test 1: Valid Signature**
```javascript
test('should verify valid HMAC signature', () => {
  const payload = '{"test":"data"}';
  const secret = 'test_secret';
  const signature = generateSignature(payload, secret);
  
  const isValid = verifyHmacSignature(payload, signature, secret);
  expect(isValid).toBe(true);
});
```

**Test 2: Invalid Signature**
```javascript
test('should reject invalid HMAC signature', () => {
  const payload = '{"test":"data"}';
  const secret = 'test_secret';
  const signature = 'invalid_signature';
  
  const isValid = verifyHmacSignature(payload, signature, secret);
  expect(isValid).toBe(false);
});
```

**Test 3: Replay Attack Prevention**
```javascript
test('should detect replay attacks', () => {
  const processedCallbacks = new Map();
  const callbackId = 'test_callback_123';
  
  // First time - should be new
  isCallbackNew(processedCallbacks, callbackId);
  
  // Second time - should be detected as replay
  const isNew = isCallbackNew(processedCallbacks, callbackId);
  expect(isNew).toBe(false);
});
```

### Idempotency Testing

**Test 1: Idempotency Key Generation**
```javascript
test('should generate unique idempotency keys', () => {
  const key1 = generateIdempotencyKey();
  const key2 = generateIdempotencyKey();
  
  expect(key1).not.toBe(key2);
});
```

**Test 2: Deterministic Key Generation**
```javascript
test('should generate deterministic keys for same parameters', () => {
  const params = {
    operatorId: '1',
    phone: '254700000000',
    amount: 100,
    transactionId: 'tx_123',
  };
  
  const key1 = createDeterministicKey(params);
  const key2 = createDeterministicKey(params);
  
  expect(key1).toBe(key2);
});
```

## Integration Testing

### End-to-End Payment Flow

**Test Complete Payment Flow:**
1. Initiate payment via platform API
2. Complete payment on phone
3. Receive webhook callback
4. Verify payment status updated
5. Verify Wi-Fi access provisioned
6. Verify SMS notification sent (if configured)

```javascript
test('should complete full payment flow', async () => {
  // 1. Initiate payment
  const initiation = await initiatePayment({
    phone: '254700000000',
    amount: 10,
    macAddress: '00:11:22:33:44:55',
  });
  
  expect(initiation.success).toBe(true);
  
  // 2. Simulate callback (or complete on phone)
  const callback = await simulateCallback(initiation.transactionId);
  
  // 3. Verify payment status
  const payment = await prisma.payment.findUnique({
    where: { transactionId: initiation.transactionId }
  });
  
  expect(payment.status).toBe('completed');
  
  // 4. Verify Wi-Fi access
  expect(payment.accessStatus).toBe('granted');
});
```

### End-to-End SMS Flow

**Test Complete SMS Flow:**
1. Trigger SMS event (payment confirmation)
2. Send SMS via provider
3. Receive delivery callback
4. Update delivery status
5. Verify delivery status in database

## Performance Testing

### Rate Limiting

**Test Rate Limit Handling:**
```javascript
test('should handle rate limiting gracefully', async () => {
  const adapter = new AfricaTalkingAdapter();
  
  // Send multiple requests rapidly
  const promises = Array(100).fill().map(() =>
    adapter.sendSms(
      { /* credentials */ },
      { to: '254700000000', message: 'Test' }
    )
  );
  
  const results = await Promise.allSettled(promises);
  
  // Some should succeed, some should fail due to rate limiting
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  expect(successCount).toBeGreaterThan(0);
});
```

### Timeout Handling

**Test Timeout Scenarios:**
```javascript
test('should handle provider timeouts', async () => {
  // Mock slow provider response
  jest.spyOn(axios, 'post').mockImplementation(() =>
    new Promise(resolve => setTimeout(() => resolve({ data: {} }), 30000))
  );
  
  const adapter = new DarajaAdapter();
  const result = await adapter.initiatePayment(
    { /* credentials */ },
    { /* request */ }
  );
  
  expect(result.success).toBe(false);
  expect(result.errorMessage).toContain('timeout');
});
```

## Test Data Management

### Test Database

Use a separate test database:
```env
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/wifi_billing_test
```

### Test Cleanup

Clean up test data after each test:
```javascript
afterEach(async () => {
  await prisma.payment.deleteMany();
  await prisma.smsLog.deleteMany();
});
```

### Mock Provider Responses

Use mocked responses for unit tests:
```javascript
jest.mock('axios', () => ({
  post: jest.fn(() => Promise.resolve({ data: { success: true } })),
  get: jest.fn(() => Promise.resolve({ data: { balance: 100 } })),
}));
```

## Test Reporting

### Test Results Format

Document test results in a standard format:

| Test Case | Provider | Status | Notes |
|-----------|----------|--------|-------|
| STK Push Initiation | Daraja | ✅ Pass | Works in sandbox |
| Invalid Phone Number | Daraja | ✅ Pass | Correctly rejected |
| Payment Initiation | PayHero | ✅ Pass | Works in sandbox |
| Status Check | PayHero | ✅ Pass | Returns correct status |
| Send SMS | Africa's Talking | ✅ Pass | Message received |
| Balance Check | Africa's Talking | ✅ Pass | Balance matches dashboard |
| Send SMS | Twilio | ✅ Pass | Message received |

### Test Coverage

Aim for:
- **Unit tests:** 80%+ code coverage
- **Integration tests:** All critical paths
- **End-to-end tests:** Main user flows

## Continuous Integration

### CI/CD Pipeline

Configure automated testing in CI/CD:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:integration
```

## Pre-Production Checklist

Before deploying to production:

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Sandbox testing completed
- [ ] Webhook signature verification tested
- [ ] Idempotency tested
- [ ] Error handling tested
- [ ] Rate limiting tested
- [ ] Timeout handling tested
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Alert rules set up

## Troubleshooting Tests

### Tests Failing in CI

1. Check environment variables are set
2. Verify test database is accessible
3. Check for timing issues (add delays if needed)
4. Verify mock configurations

### Sandbox Tests Failing

1. Verify sandbox credentials are valid
2. Check sandbox API is operational
3. Verify callback URL is accessible
4. Check network connectivity

### Flaky Tests

1. Identify race conditions
2. Add proper waits/delays
3. Use deterministic test data
4. Isolate tests from each other

## References

- [Payment Providers](PAYMENT_PROVIDERS.md)
- [SMS Providers](SMS_PROVIDERS.md)
- [Webhook Security](WEBHOOK_SECURITY.md)
- [Provider Configuration](PROVIDER_CONFIGURATION.md)
- [Adding a Provider](../ADDING_A_PROVIDER.md)
