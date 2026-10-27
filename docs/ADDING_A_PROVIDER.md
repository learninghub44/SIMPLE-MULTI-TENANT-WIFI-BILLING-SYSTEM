# Adding a New Provider

This guide provides step-by-step instructions for developers to add a new payment or SMS provider to the WiFi Billing System.

## Overview

The platform uses a pluggable architecture where providers implement a common adapter interface. Adding a new provider involves creating an adapter class, registering it with the registry, and documenting its capabilities.

## Adding a Payment Provider

### Step 1: Review the Official API Documentation

Before implementing, thoroughly review the provider's official API documentation:

- Locate the official developer documentation
- Understand authentication mechanisms
- Identify supported payment methods
- Document webhook/callback structure
- Note any limitations or special requirements
- Check sandbox availability
- Review pricing and commercial terms

**Do not invent API endpoints, request payloads, signatures, or capabilities.**

### Step 2: Confirm Countries, Merchant Eligibility, and Payment Capabilities

Verify the following before proceeding:

- **Supported Countries:** Does the provider operate in your target markets?
- **Merchant Eligibility:** What are the requirements to become a merchant?
- **Payment Methods:** What payment methods are supported (M-Pesa, cards, bank transfer, etc.)?
- **Settlement:** How and when are funds settled?
- **Fees:** What are the transaction fees?
- **Minimum/Maximum Amounts:** Are there transaction limits?

Document these findings in `docs/integrations/PAYMENT_PROVIDERS.md`.

### Step 3: Create a Provider Adapter

Create a new adapter class in `src/integrations/payments/providers/{provider-name}/`:

```javascript
const PaymentAdapter = require('../../contracts/PaymentAdapter');
const { validatePhone, validateCredentials } = require('../../../shared/validation/Validator');
const logger = require('../../../../src/logger');

class YourProviderAdapter extends PaymentAdapter {
  /**
   * Get provider metadata
   * @returns {PaymentProviderMetadata}
   */
  getMetadata() {
    return {
      providerId: 'your-provider-id',
      displayName: 'Your Provider Name',
      supportedCountries: ['KE', 'UG'], // ISO country codes
      supportedMethods: [
        {
          id: 'mpesa',
          displayName: 'M-Pesa',
          supportedCurrencies: ['KES'],
          limits: { minAmount: 10, maxAmount: 150000 },
        },
      ],
      capabilities: {
        initiatePayment: true,
        verifyCallback: true,
        checkStatus: true, // if supported
        refund: false, // if not supported
        idempotency: false, // if not supported
        webhooks: true,
        preAuth: false,
      },
      requiredCredentials: [
        {
          key: 'apiKey',
          displayName: 'API Key',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'your_api_key',
          description: 'From provider dashboard',
        },
        // Add more credential fields as needed
      ],
      requiresWebhook: true,
      documentationUrl: 'https://provider.example.com/docs',
      sandboxUrl: 'https://sandbox.provider.example.com',
      productionUrl: 'https://api.provider.example.com',
    };
  }

  /**
   * Validate provider credentials
   * @param {Object} credentials - Provider credentials object
   * @returns {Promise<ValidationResult>}
   */
  async validateCredentials(credentials) {
    const schema = this.getMetadata().requiredCredentials;
    const validation = validateCredentials(credentials, schema);

    if (!validation.valid) {
      return validation;
    }

    // Try to make a test API call to verify credentials
    try {
      // Implement credential verification
      const result = await this.verifyWithProvider(credentials);
      if (result.success) {
        return { valid: true, errors: [], warnings: validation.warnings };
      }
      return { valid: false, errors: ['Authentication failed'], warnings: validation.warnings };
    } catch (error) {
      return { valid: false, errors: [error.message], warnings: validation.warnings };
    }
  }

  /**
   * Initiate a payment
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {PaymentInitiationRequest} request - Payment initiation request
   * @returns {Promise<PaymentInitiationResult>}
   */
  async initiatePayment(operatorConfig, request) {
    const { amount, phone, transactionId, callbackUrl } = request;

    // Validate inputs
    const phoneValidation = validatePhone(phone, 'KE');
    if (!phoneValidation.valid) {
      return {
        success: false,
        errorMessage: phoneValidation.error,
      };
    }

    // Implement payment initiation
    try {
      const response = await this.callProviderApi(operatorConfig, {
        amount,
        phone: phoneValidation.normalized,
        transactionId,
        callbackUrl,
      });

      return {
        success: true,
        providerReference: response.reference,
        checkoutId: response.checkoutId,
        status: 'pending',
        raw: response,
      };
    } catch (error) {
      logger.error('Payment initiation failed', { error: error.message });
      return {
        success: false,
        errorMessage: error.message,
        raw: error.response?.data,
      };
    }
  }

  /**
   * Verify webhook callback signature
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {Object} headers - HTTP headers from callback
   * @param {Object} body - Callback request body
   * @returns {Promise<CallbackVerificationResult>}
   */
  async verifyCallback(operatorConfig, headers, body) {
    // Implement signature verification if provider supports it
    const { verifyHmacSignature } = require('../../../shared/webhook/WebhookSecurity');
    
    const signature = headers['x-signature'] || headers['X-Signature'];
    const isValid = verifyHmacSignature(
      JSON.stringify(body),
      signature,
      operatorConfig.webhookSecret
    );

    if (!isValid) {
      return {
        valid: false,
        errorMessage: 'Invalid signature',
      };
    }

    // Extract callback data
    return {
      valid: true,
      transactionId: body.transactionId,
      providerReference: body.reference,
      status: this.normalizeStatus(body.status),
      amount: body.amount,
      receipt: body.receipt,
    };
  }

  /**
   * Check transaction status (if supported)
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {string} providerReference - Provider's transaction reference
   * @returns {Promise<TransactionStatusResult>}
   */
  async checkStatus(operatorConfig, providerReference) {
    if (!this.supportsCapability('checkStatus')) {
      return {
        success: false,
        status: 'unknown',
        errorMessage: 'Status checks not supported by this provider',
      };
    }

    try {
      const response = await this.callProviderStatusApi(operatorConfig, providerReference);
      return {
        success: true,
        status: this.normalizeStatus(response.status),
        amount: response.amount,
        receipt: response.receipt,
        raw: response,
      };
    } catch (error) {
      return {
        success: false,
        status: 'unknown',
        errorMessage: error.message,
        raw: error.response?.data,
      };
    }
  }

  /**
   * Normalize provider status to internal status
   * @param {string} providerStatus - Provider's raw status
   * @returns {string} - Normalized status: "pending", "completed", "failed", "unknown"
   */
  normalizeStatus(providerStatus) {
    const status = String(providerStatus).toLowerCase();
    
    if (status === 'success' || status === 'completed' || status === 'paid') {
      return 'completed';
    }
    if (status === 'failed' || status === 'cancelled' || status === 'rejected') {
      return 'failed';
    }
    if (status === 'pending' || status === 'processing') {
      return 'pending';
    }
    
    return 'unknown';
  }

  /**
   * Process a refund (if supported)
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {string} providerReference - Original transaction reference
   * @param {number} amount - Amount to refund
   * @param {string} [reason] - Refund reason
   * @returns {Promise<RefundResult>}
   */
  async refund(operatorConfig, providerReference, amount, reason) {
    if (!this.supportsCapability('refund')) {
      return {
        success: false,
        status: 'failed',
        errorMessage: 'Refunds not supported by this provider',
      };
    }

    try {
      const response = await this.callProviderRefundApi(operatorConfig, {
        reference: providerReference,
        amount,
        reason,
      });

      return {
        success: true,
        refundId: response.refundId,
        status: 'pending',
        raw: response,
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        errorMessage: error.message,
        raw: error.response?.data,
      };
    }
  }
}

module.exports = YourProviderAdapter;
```

### Step 4: Add the Provider to the Registry

Register the provider in `src/integrations/payments/index.js`:

```javascript
const YourProviderAdapter = require('./providers/your-provider/YourProviderAdapter');

function initializePaymentProviders() {
  // ... existing providers ...

  // Register your provider
  const yourProviderAdapter = new YourProviderAdapter();
  paymentRegistry.register(yourProviderAdapter, {
    enabled: true,
    isDefault: false, // Set to true if this should be the default
  });

  return paymentRegistry;
}
```

### Step 5: Implement Credential Validation and Safe Configuration

- Ensure all sensitive credentials are marked as `sensitive: true`
- Use the existing `validateCredentials` utility
- Implement credential verification via a test API call
- Store credentials per-operator with encryption

### Step 6: Implement Payment Initiation and Normalized Responses

- Validate all inputs (phone, amount, currency)
- Normalize phone numbers to provider's required format
- Handle provider-specific error responses
- Return normalized success/failure results
- Include raw provider response for debugging

### Step 7: Implement Verified Callbacks or Webhooks

- Implement signature verification if provider supports HMAC
- Use the `WebhookSecurity` utilities
- Validate callback structure
- Extract transaction ID, amount, and status
- Normalize provider status to internal status

### Step 8: Implement Authoritative Transaction Status Verification

- If provider supports status queries, implement `checkStatus`
- Use authoritative status verification for final confirmation
- Normalize status responses
- Handle API errors gracefully

### Step 9: Ensure Duplicate Events Cannot Duplicate Payments or Access

- Use the `IdempotencyManager` for idempotency
- Generate idempotency keys for payment initiation
- Track processed callbacks to prevent replay attacks
- Use database constraints where appropriate

### Step 10: Add Unit and Integration Tests

Create tests in `tests/integrations/payments/{provider-name}.test.js`:

```javascript
const YourProviderAdapter = require('../../src/integrations/payments/providers/your-provider/YourProviderAdapter');

describe('YourProviderAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new YourProviderAdapter();
  });

  test('should return correct metadata', () => {
    const metadata = adapter.getMetadata();
    expect(metadata.providerId).toBe('your-provider-id');
    expect(metadata.supportedCountries).toContain('KE');
  });

  test('should validate credentials', async () => {
    const result = await adapter.validateCredentials({
      apiKey: 'test_key',
    });
    expect(result.valid).toBeDefined();
  });

  test('should initiate payment', async () => {
    const result = await adapter.initiatePayment(
      { apiKey: 'test_key' },
      {
        amount: 100,
        phone: '254712345678',
        transactionId: 'test_tx_123',
        callbackUrl: 'https://example.com/callback',
      }
    );
    expect(result.success).toBeDefined();
  });

  // Add more tests...
});
```

### Step 11: Add a Sandbox Test Procedure

Document the sandbox testing procedure in `docs/integrations/PROVIDER_TESTING.md`:

1. How to access the sandbox environment
2. Test credentials (if available)
3. Test payment initiation
4. Test callback handling
5. Test status queries
6. Expected responses and error cases

### Step 12: Add Environment Variable Documentation

Add provider-specific environment variables to `.env.example`:

```env
# Your Provider Configuration
YOUR_PROVIDER_ENABLED=true
YOUR_PROVIDER_API_KEY=your_api_key
YOUR_PROVIDER_WEBHOOK_SECRET=your_webhook_secret
YOUR_PROVIDER_ENV=sandbox  # or "production"
```

### Step 13: Add Operator Settings UI (If Required)

If the provider requires per-operator configuration:

1. Add credential fields to the Operator model in `prisma/schema.prisma`
2. Create UI fields in the operator settings page
3. Implement credential encryption/decryption
4. Add configuration validation
5. Test the configuration flow

### Step 14: Update the Provider Capability Matrix and Integration Documentation

Update the following documents:

- `docs/integrations/PAYMENT_PROVIDERS.md` - Add provider documentation
- `docs/integrations/PROVIDER_SUPPORT_MATRIX.md` - Add provider to matrix
- `docs/integrations/WEBHOOK_SECURITY.md` - Document webhook security if applicable

## Adding an SMS Provider

### Step 1: Review the Official API Documentation

- Locate official SMS API documentation
- Understand authentication mechanisms
- Identify supported countries
- Document delivery report structure
- Note sender ID requirements
- Check sandbox availability
- Review pricing

### Step 2: Confirm Country Coverage and Sender Requirements

Verify:
- **Supported Countries:** Does the provider support your target countries?
- **Sender ID Requirements:** Are sender IDs pre-registered?
- **Delivery Reports:** Are delivery callbacks supported?
- **Unicode Support:** Does it support special characters?
- **Pricing:** What are the per-SMS costs?

### Step 3: Implement the SMS Adapter

Create a new adapter class in `src/integrations/sms/providers/{provider-name}/`:

```javascript
const SmsAdapter = require('../../contracts/SmsAdapter');
const { validatePhone, validateCredentials } = require('../../../shared/validation/Validator');
const logger = require('../../../../src/logger');

class YourSmsProviderAdapter extends SmsAdapter {
  /**
   * Get provider metadata
   * @returns {SmsProviderMetadata}
   */
  getMetadata() {
    return {
      providerId: 'your-sms-provider-id',
      displayName: 'Your SMS Provider',
      supportedCountries: ['KE', 'UG'],
      capabilities: {
        sendSms: true,
        deliveryReports: true,
        senderId: true,
        bulkSend: true,
        balanceCheck: true,
        scheduledSend: false,
        unicode: true,
        flashSms: false,
      },
      requiredCredentials: [
        {
          key: 'apiKey',
          displayName: 'API Key',
          type: 'string',
          required: true,
          sensitive: true,
          placeholder: 'your_api_key',
        },
      ],
      documentationUrl: 'https://provider.example.com/docs',
      sandboxUrl: 'https://sandbox.provider.example.com',
      productionUrl: 'https://api.provider.example.com',
      pricing: {
        perSms: '0.80',
        currency: 'KES',
      },
    };
  }

  /**
   * Validate provider credentials
   * @param {Object} credentials - Provider credentials object
   * @returns {Promise<ValidationResult>}
   */
  async validateCredentials(credentials) {
    const schema = this.getMetadata().requiredCredentials;
    const validation = validateCredentials(credentials, schema);

    if (!validation.valid) {
      return validation;
    }

    // Verify credentials via balance check or test SMS
    try {
      const balance = await this.checkBalance(credentials);
      if (balance.success) {
        return { valid: true, errors: [], warnings: validation.warnings };
      }
      return { valid: false, errors: ['Authentication failed'], warnings: validation.warnings };
    } catch (error) {
      return { valid: false, errors: [error.message], warnings: validation.warnings };
    }
  }

  /**
   * Send an SMS message
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {SmsMessage} message - SMS message to send
   * @returns {Promise<SmsSendResult>}
   */
  async sendSms(operatorConfig, message) {
    const { to, message: smsContent, senderId } = message;

    // Validate phone number
    const phoneValidation = validatePhone(to, 'KE');
    if (!phoneValidation.valid) {
      return {
        success: false,
        errorMessage: phoneValidation.error,
      };
    }

    // Truncate message if needed
    const truncatedMessage = this.truncateMessage(smsContent, 1600);

    try {
      const response = await this.callProviderSmsApi(operatorConfig, {
        to: phoneValidation.normalized,
        message: truncatedMessage,
        senderId,
      });

      return {
        success: true,
        messageId: response.messageId,
        status: response.status,
        cost: response.cost,
        currency: response.currency,
        raw: response,
      };
    } catch (error) {
      logger.error('SMS send failed', { error: error.message });
      return {
        success: false,
        errorMessage: error.message,
        errorCode: error.response?.status,
        raw: error.response?.data,
      };
    }
  }

  /**
   * Process delivery report callback (if supported)
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {Object} headers - HTTP headers from callback
   * @param {Object} body - Callback request body
   * @returns {Promise<DeliveryReport>}
   */
  async processDeliveryReport(operatorConfig, headers, body) {
    const messageId = body.messageId;
    const status = body.status;

    if (!messageId) {
      throw new Error('Missing message ID in delivery report');
    }

    // Normalize status
    let normalizedStatus = 'unknown';
    if (status) {
      const statusLower = String(status).toLowerCase();
      if (statusLower === 'delivered') {
        normalizedStatus = 'delivered';
      } else if (statusLower === 'failed') {
        normalizedStatus = 'failed';
      } elseif (statusLower === 'pending') {
        normalizedStatus = 'pending';
      }
    }

    return {
      messageId,
      status: normalizedStatus,
      deliveredAt: body.timestamp ? new Date(body.timestamp) : null,
      failureReason: body.failureReason || null,
      raw: body,
    };
  }

  /**
   * Check account balance (if supported)
   * @param {Object} operatorConfig - Operator's provider configuration
   * @returns {Promise<BalanceInfo>}
   */
  async checkBalance(operatorConfig) {
    try {
      const response = await this.callProviderBalanceApi(operatorConfig);
      return {
        success: true,
        balance: response.balance,
        currency: response.currency,
        raw: response,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error.message,
        raw: error.response?.data,
      };
    }
  }
}

module.exports = YourSmsProviderAdapter;
```

### Step 4: Register the Provider

Register in `src/integrations/sms/index.js`:

```javascript
const YourSmsProviderAdapter = require('./providers/your-sms-provider/YourSmsProviderAdapter');

function initializeSmsProviders() {
  // ... existing providers ...

  const yourSmsAdapter = new YourSmsProviderAdapter();
  smsRegistry.register(yourSmsAdapter, {
    enabled: true,
    isDefault: false,
  });

  return smsRegistry;
}
```

### Step 5: Secure Its Credentials

- Use per-operator encrypted storage
- Mark all sensitive credentials
- Implement credential validation
- Never log or expose credentials

### Step 6: Normalize Sending Results and Provider Errors

- Normalize success/failure responses
- Map provider error codes to standard errors
- Include raw response for debugging
- Handle rate limits gracefully

### Step 7: Add Delivery Callbacks If Supported

- Implement callback signature verification
- Parse delivery report structure
- Normalize delivery status
- Update delivery status in database

### Step 8: Add Tests with Mocked API Responses

Create tests in `tests/integrations/sms/{provider-name}.test.js`:

```javascript
const YourSmsProviderAdapter = require('../../src/integrations/sms/providers/your-sms-provider/YourSmsProviderAdapter');

describe('YourSmsProviderAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new YourSmsProviderAdapter();
  });

  test('should send SMS', async () => {
    const result = await adapter.sendSms(
      { apiKey: 'test_key' },
      {
        to: '254712345678',
        message: 'Test message',
      }
    );
    expect(result.success).toBeDefined();
  });

  // Add more tests...
});
```

### Step 9: Document Setup and Configuration

Update:
- `docs/integrations/SMS_PROVIDERS.md` - Add provider documentation
- `docs/integrations/PROVIDER_SUPPORT_MATRIX.md` - Add provider to matrix
- `.env.example` - Add environment variables

### Step 10: Verify the Integration Using an Authorized Test Account

1. Obtain test credentials from the provider
2. Configure the provider in the platform
3. Send test SMS messages
4. Verify delivery reports
5. Check balance queries
6. Test error scenarios

## Best Practices

### Security
- **Never** log sensitive credentials
- **Always** encrypt credentials at rest
- **Always** verify webhook signatures
- **Always** validate callback data
- **Never** trust browser redirects for payment confirmation

### Reliability
- Use idempotency keys for all payment requests
- Implement retry logic with exponential backoff
- Handle provider timeouts gracefully
- Log all provider interactions
- Monitor error rates

### Testing
- Test with sandbox environment first
- Mock API responses in unit tests
- Test error scenarios
- Test webhook signature verification
- Test idempotency

### Documentation
- Document all provider capabilities
- Document credential requirements
- Document API limitations
- Update support matrix
- Provide troubleshooting guide

## Common Pitfalls

1. **Inventing API Details:** Always use official documentation
2. **Ignoring Webhook Security:** Always implement signature verification
3. **Missing Idempotency:** Always handle duplicate events
4. **Hardcoding Credentials:** Use environment variables or encrypted storage
5. **Ignoring Error Cases:** Test and handle all error scenarios
6. **Forgetting Documentation:** Keep documentation in sync with code
7. **Skipping Sandbox Testing:** Always test in sandbox before production

## Support

For questions or issues:
1. Check existing documentation
2. Review similar provider implementations
3. Consult the provider's official documentation
4. Create an issue in the repository with details
