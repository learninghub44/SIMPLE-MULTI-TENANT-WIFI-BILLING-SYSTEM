# Provider Troubleshooting Documentation

This document provides troubleshooting guidance for payment and SMS provider issues in the WiFi Billing System.

## Common Payment Provider Issues

### Daraja (M-Pesa)

#### Issue: STK Push Not Initiated

**Symptoms:**
- Payment initiation returns error
- No STK push received on phone
- Error: "Failed to get MPesa access token"

**Possible Causes:**
1. Invalid or expired credentials
2. Wrong environment (sandbox vs production)
3. Network connectivity issues
4. Daraja API downtime

**Troubleshooting Steps:**

1. **Verify Credentials**
   ```bash
   # Check environment variables
   echo $MPESA_CONSUMER_KEY
   echo $MPESA_CONSUMER_SECRET
   echo $MPESA_SHORTCODE
   echo $MPESA_PASSKEY
   ```

2. **Check Environment**
   ```bash
   # Verify MPESA_ENV is set correctly
   echo $MPESA_ENV  # Should be "sandbox" or "production"
   ```

3. **Test API Access**
   ```bash
   # Test OAuth endpoint
   curl -X GET "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" \
     -H "Authorization: Basic $(echo -n "$MPESA_CONSUMER_KEY:$MPESA_CONSUMER_SECRET" | base64)"
   ```

4. **Check Server Logs**
   ```bash
   # Look for Daraja-related errors
   tail -f logs/app.log | grep -i daraja
   ```

**Solution:**
- Update credentials with valid values from Daraja dashboard
- Ensure environment matches credentials (sandbox vs production)
- Check Daraja status page for outages
- Verify network connectivity to Daraja API

---

#### Issue: Callback Not Received

**Symptoms:**
- Payment completed on phone
- No callback received by platform
- Payment status remains "pending"

**Possible Causes:**
1. Callback URL not accessible
2. Callback URL blocked by firewall
3. Wrong callback URL configured
4. Daraja not sending callbacks

**Troubleshooting Steps:**

1. **Verify Callback URL**
   ```bash
   # Check callback URL is publicly accessible
   curl -X POST $MPESA_CALLBACK_URL -d '{"test":"data"}'
   ```

2. **Check Server Logs**
   ```bash
   # Look for callback requests
   tail -f logs/app.log | grep -i callback
   ```

3. **Test with ngrok**
   ```bash
   # Use ngrok for local testing
   ngrok http 5000
   # Update MPESA_CALLBACK_URL with ngrok URL
   ```

4. **Check Daraja Dashboard**
   - Login to Daraja developer portal
   - Check callback logs
   - Verify callback URL is registered

**Solution:**
- Ensure callback URL is publicly accessible
- Configure firewall to allow incoming requests
- Use ngrok or similar for local development
- Verify callback URL in Daraja dashboard

---

#### Issue: Payment Amount Mismatch

**Symptoms:**
- Callback received but payment rejected
- Error: "Payment amount did not match"
- Payment status set to "failed"

**Possible Causes:**
1. Callback amount differs from initiated amount
2. Currency mismatch
3. Decimal point issues

**Troubleshooting Steps:**

1. **Check Payment Record**
   ```javascript
   const payment = await prisma.payment.findUnique({
     where: { transactionId: 'your_transaction_id' }
   });
   console.log('Initiated amount:', payment.amount);
   ```

2. **Check Callback Amount**
   ```javascript
   const callbackAmount = callbackData?.CallbackMetadata?.Item?.find(
     (item) => item.Name === "Amount"
   )?.Value;
   console.log('Callback amount:', callbackAmount);
   ```

3. **Compare Amounts**
   - Ensure both are in same currency (KES)
   - Ensure both are integers (not decimals)
   - Check for rounding issues

**Solution:**
- Ensure amount is sent as integer (not decimal)
- Verify currency is consistent
- Add logging to debug amount mismatches

---

### PayHero

#### Issue: Payment Initiation Fails

**Symptoms:**
- Payment initiation returns error
- Error: "PayHero did not return a transaction reference"

**Possible Causes:**
1. Invalid PayHero credentials
2. Channel ID not configured
3. PayHero API downtime
4. Invalid phone number format

**Troubleshooting Steps:**

1. **Verify Credentials**
   ```javascript
   // Check operator has PayHero configured
   const operator = await prisma.operator.findUnique({
     where: { id: operatorId }
   });
   console.log('Has username:', !!operator.payheroUsernameCiphertext);
   console.log('Has password:', !!operator.payheroPasswordCiphertext);
   console.log('Has channel ID:', !!operator.payheroChannelId);
   ```

2. **Test Credentials**
   ```javascript
   const adapter = new PayHeroAdapter();
   const validation = await adapter.validateCredentials({
     username: decryptedUsername,
     password: decryptedPassword,
     channelId: channelId,
   });
   console.log('Credentials valid:', validation.valid);
   ```

3. **Check PayHero API Status**
   - Contact PayHero support
   - Check if API is operational

**Solution:**
- Re-enter PayHero credentials
- Verify channel ID is correct
- Contact PayHero support if API is down
- Ensure phone number is in correct format

---

#### Issue: Status Check Fails

**Symptoms:**
- Status check returns error
- Unable to verify payment status
- Error: "Failed to get transaction status"

**Possible Causes:**
1. Invalid transaction reference
2. Credentials expired
3. PayHero API issue

**Troubleshooting Steps:**

1. **Verify Transaction Reference**
   ```javascript
   const payment = await prisma.payment.findUnique({
     where: { transactionId: 'your_transaction_id' }
   });
   console.log('Provider reference:', payment.providerReference);
   ```

2. **Test Status Check**
   ```javascript
   const adapter = new PayHeroAdapter();
   const result = await adapter.checkStatus(
     operatorConfig,
     payment.providerReference
   );
   console.log('Status check result:', result);
   ```

**Solution:**
- Ensure provider reference is stored correctly
- Verify credentials are still valid
- Contact PayHero support if API issue persists

---

## Common SMS Provider Issues

### Africa's Talking

#### Issue: SMS Not Delivered

**Symptoms:**
- SMS send returns success
- Message not received on phone
- Delivery status shows "failed"

**Possible Causes:**
1. Invalid phone number format
2. Insufficient balance
3. Sender ID not registered
4. Phone number opted out

**Troubleshooting Steps:**

1. **Check Phone Number Format**
   ```javascript
   const adapter = new AfricaTalkingAdapter();
   const normalized = adapter.normalizePhoneNumber('0712345678', '254');
   console.log('Normalized:', normalized); // Should be 254712345678
   ```

2. **Check Account Balance**
   ```javascript
   const adapter = new AfricaTalkingAdapter();
   const balance = await adapter.checkBalance(credentials);
   console.log('Balance:', balance.balance);
   ```

3. **Check Delivery Status**
   ```javascript
   // Check SMS log for delivery status
   const smsLog = await prisma.smsLog.findUnique({
     where: { messageId: 'your_message_id' }
   });
   console.log('Delivery status:', smsLog.deliveryStatus);
   ```

**Solution:**
- Normalize phone number to E.164 format
- Top up account balance
- Register sender ID with Africa's Talking
- Check if phone number is on opt-out list

---

#### Issue: Balance Check Fails

**Symptoms:**
- Balance check returns error
- Error: "Authentication failed"
- Unable to check account balance

**Possible Causes:**
1. Invalid API credentials
2. Wrong username
3. Account suspended

**Troubleshooting Steps:**

1. **Verify Credentials**
   ```bash
   # Check environment variables or database
   echo $AFRICASTALKING_USERNAME
   echo $AFRICASTALKING_API_KEY
   ```

2. **Test API Access**
   ```bash
   # Test balance endpoint
   curl -X GET "https://api.africastalking.com/version1/user" \
     -d "username=$AFRICASTALKING_USERNAME" \
     -H "apiKey: $AFRICASTALKING_API_KEY"
   ```

**Solution:**
- Verify username and API key are correct
- Check account status on Africa's Talking dashboard
- Regenerate API key if needed

---

### Twilio

#### Issue: SMS Not Sent

**Symptoms:**
- SMS send returns error
- Error: "Unauthenticated"
- Error: "Invalid From number"

**Possible Causes:**
1. Invalid Account SID or Auth Token
2. Invalid sender ID
3. Unverified phone number
4. Insufficient Twilio balance

**Troubleshooting Steps:**

1. **Verify Credentials**
   ```bash
   echo $TWILIO_ACCOUNT_SID
   echo $TWILIO_AUTH_TOKEN
   ```

2. **Check Sender ID**
   ```bash
   # Verify sender ID is valid
   # Must be a verified number or messaging service SID
   echo $TWILIO_FROM_NUMBER
   ```

3. **Check Twilio Console**
   - Login to Twilio console
   - Check account balance
   - Verify phone numbers are verified
   - Check error logs

**Solution:**
- Verify Account SID and Auth Token
- Use verified phone number or messaging service
- Top up Twilio balance
- Check Twilio console for specific error details

---

#### Issue: Delivery Report Not Received

**Symptoms:**
- SMS sent successfully
- No delivery callback received
- Delivery status remains unknown

**Possible Causes:**
1. Callback URL not configured in Twilio
2. Callback URL not accessible
3. Webhook signature verification failing

**Troubleshooting Steps:**

1. **Check Callback URL Configuration**
   - Login to Twilio console
   - Go to Messaging Services
   - Verify callback URL is set

2. **Test Callback URL**
   ```bash
   # Test if callback URL is accessible
   curl -X POST https://your-callback-url.com/twilio/delivery \
     -d '{"MessageSid":"test","MessageStatus":"delivered"}'
   ```

3. **Check Signature Verification**
   ```javascript
   // Verify signature verification is working
   const { verifyHmacSignature } = require('./src/integrations/shared/webhook/WebhookSecurity');
   const isValid = verifyHmacSignature(payload, signature, authToken);
   console.log('Signature valid:', isValid);
   ```

**Solution:**
- Configure callback URL in Twilio console
- Ensure callback URL is publicly accessible
- Verify signature verification implementation
- Check server logs for callback requests

---

## General Issues

### Issue: Provider Not Registered

**Symptoms:**
- Error: "Provider is not registered"
- Unable to use provider

**Possible Causes:**
1. Provider not initialized
2. Provider disabled
3. Registry not loaded

**Troubleshooting Steps:**

1. **Check Registry**
   ```javascript
   const { paymentRegistry } = require('./src/integrations/payments/index');
   const stats = paymentRegistry.getStatistics();
   console.log('Registered providers:', stats);
   ```

2. **Check Initialization**
   ```javascript
   // Ensure providers are initialized on server startup
   const { initializePaymentProviders } = require('./src/integrations/payments/index');
   initializePaymentProviders();
   ```

3. **Enable Provider**
   ```javascript
   paymentRegistry.enable('daraja');
   ```

**Solution:**
- Ensure provider initialization is called on startup
- Check if provider is disabled and enable it
- Verify provider is registered in index.js

---

### Issue: Credential Decryption Fails

**Symptoms:**
- Error: "Stored operator credential has an unsupported format"
- Unable to use operator credentials

**Possible Causes:**
1. Encryption key changed
2. Credential format corrupted
3. Wrong encryption key source

**Troubleshooting Steps:**

1. **Check Encryption Key**
   ```bash
   # Check which key is being used
   echo $PAYMENT_CREDENTIALS_KEY
   echo $SESSION_SECRET
   echo $JWT_SECRET
   ```

2. **Check Credential Format**
   ```javascript
   const credential = operator.payheroUsernameCiphertext;
   console.log('Credential format:', credential.split('.')[0]); // Should be "v1"
   ```

**Solution:**
- Ensure encryption key hasn't changed
- If key changed, operators must re-enter credentials
- Verify credential format is correct

---

### Issue: Idempotency Key Collision

**Symptoms:**
- Error: "Request with this idempotency key has already been processed"
- Payment rejected as duplicate

**Possible Causes:**
1. Duplicate payment initiation
2. Idempotency key reuse
3. Idempotency store not cleaned up

**Troubleshooting Steps:**

1. **Check Idempotency Store**
   ```javascript
   const { idempotencyStore } = require('./src/integrations/shared/idempotency/IdempotencyManager');
   const stats = idempotencyStore.getStats();
   console.log('Store stats:', stats);
   ```

2. **Check for Existing Key**
   ```javascript
   const { isRequestProcessed } = require('./src/integrations/shared/idempotency/IdempotencyManager');
   const processed = isRequestProcessed(idempotencyKey);
   console.log('Already processed:', processed);
   ```

**Solution:**
- Generate new idempotency key for new requests
- Clean up expired idempotency records
- Use deterministic keys only for same request

---

### Issue: Webhook Signature Verification Fails

**Symptoms:**
- Callback rejected
- Error: "Invalid signature"
- Error: "Signature verification failed"

**Possible Causes:**
1. Wrong webhook secret
2. Signature header name mismatch
3. Request body modified
4. Signature prefix not stripped

**Troubleshooting Steps:**

1. **Verify Webhook Secret**
   ```bash
   # Check webhook secret matches provider configuration
   echo $WEBHOOK_SECRET
   ```

2. **Check Signature Header**
   ```javascript
   const signature = headers['x-signature'] || headers['X-Signature'];
   console.log('Signature header:', signature);
   ```

3. **Check Request Body**
   ```javascript
   // Ensure raw body is used for signature calculation
   const rawBody = req.rawBody || req.body;
   console.log('Body length:', rawBody.length);
   ```

4. **Test Signature Generation**
   ```javascript
   const { generateSignature } = require('./src/integrations/shared/webhook/WebhookSecurity');
   const calculated = generateSignature(rawBody, secret);
   console.log('Calculated:', calculated);
   console.log('Received:', signature);
   ```

**Solution:**
- Verify webhook secret matches provider
- Check signature header name is correct
- Ensure raw body is used (not parsed)
- Strip signature prefix if needed (e.g., "sha256=")

---

## Debugging Tips

### Enable Debug Logging

```javascript
// Set log level to debug
process.env.LOG_LEVEL = 'debug';

// Or in code
logger.level = 'debug';
```

### Log Provider Requests

```javascript
// Log all provider API calls
logger.info('Provider API call', {
  provider: 'daraja',
  endpoint: '/mpesa/stkpush/v1/processrequest',
  payload: { /* sanitized */ },
  response: { /* sanitized */ },
});
```

### Use Provider Sandbox

Always test with sandbox environment first:
- Daraja: https://sandbox.safaricom.co.ke
- Africa's Talking: https://api.sandbox.africastalking.com
- Twilio: Test credentials provided in console

### Monitor Error Rates

Set up monitoring for:
- Payment initiation failure rate
- Callback failure rate
- SMS delivery failure rate
- API timeout rate

### Check Provider Status Pages

Monitor provider status:
- Daraja: Check Safaricom developer portal
- PayHero: Contact support
- Africa's Talking: Check status page
- Twilio: https://status.twilio.com

## Getting Help

### Documentation

- [Payment Providers](PAYMENT_PROVIDERS.md)
- [SMS Providers](SMS_PROVIDERS.md)
- [Provider Configuration](PROVIDER_CONFIGURATION.md)
- [Webhook Security](WEBHOOK_SECURITY.md)
- [Provider Testing](PROVIDER_TESTING.md)
- [Adding a Provider](../ADDING_A_PROVIDER.md)

### Provider Support

- **Daraja:** https://developer.safaricom.co.ke/support
- **PayHero:** Contact via their support channels
- **Africa's Talking:** https://www.africastalking.com/support
- **Twilio:** https://support.twilio.com

### Platform Support

For platform-specific issues:
1. Check server logs
2. Review this troubleshooting guide
3. Check GitHub issues
4. Create a new issue with:
   - Provider name
   - Error message
   - Steps to reproduce
   - Server logs (sanitized)
   - Environment details

## Common Error Messages

| Error Message | Provider | Likely Cause | Solution |
|---------------|----------|--------------|----------|
| "Failed to get MPesa access token" | Daraja | Invalid credentials | Verify credentials |
| "PayHero did not return a transaction reference" | PayHero | API error or invalid config | Check PayHero config |
| "Invalid signature" | Any | Webhook secret mismatch | Verify webhook secret |
| "Amount did not match" | Any | Callback amount differs | Check amount handling |
| "Transaction not found" | Any | Invalid transaction ID | Verify transaction ID |
| "Provider not registered" | Any | Provider not initialized | Initialize provider |
| "Authentication failed" | Any | Invalid credentials | Verify credentials |
| "Insufficient balance" | SMS | Low account balance | Top up account |
| "Invalid phone number" | Any | Wrong phone format | Normalize phone number |
| "Request timeout" | Any | Provider API slow | Check provider status |

## Prevention

### Regular Maintenance

1. **Monitor provider status** - Set up alerts for provider outages
2. **Rotate credentials** - Regularly rotate API credentials
3. **Check balances** - Monitor SMS provider balances
4. **Review logs** - Regularly review error logs
5. **Update documentation** - Keep docs in sync with changes

### Monitoring

Set up monitoring for:
- Payment success rate
- SMS delivery rate
- API response times
- Error rates
- Callback processing time

### Alerts

Configure alerts for:
- High error rate (> 5%)
- Payment failures
- SMS delivery failures
- API timeouts
- Provider outages
