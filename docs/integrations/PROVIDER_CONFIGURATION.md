# Provider Configuration Documentation

This document describes how to configure payment and SMS providers in the WiFi Billing System.

## Overview

Providers can be configured at two levels:
1. **Platform-level** - Global configuration for all operators
2. **Operator-level** - Per-operator configuration with encrypted credentials

## Platform-Level Configuration

Platform-level configuration is done via environment variables in `.env`:

### Daraja (M-Pesa)

```env
# Daraja Configuration
MPESA_ENV=sandbox  # "sandbox" or "production"
MPESA_ENABLED=true
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/mpesa/callback
```

**Notes:**
- Daraja credentials are platform-wide (shared by all operators)
- Set `MPESA_ENV=production` for production use
- Callback URL must be publicly accessible
- Shortcode and passkey must match the environment

### Platform Credentials Key

For encrypting operator-level credentials:

```env
# Optional: Dedicated key for encrypting operator credentials
# If omitted, derives from SESSION_SECRET or JWT_SECRET
PAYMENT_CREDENTIALS_KEY=your_encryption_key_here
```

**Important:** Keep this key stable. Changing it will make existing encrypted credentials unreadable.

## Operator-Level Configuration

Operator-level configuration is stored in the database and encrypted at rest.

### Payment Provider Configuration

Operators can configure payment providers via the operator settings UI or API.

#### PayHero Configuration

PayHero credentials are stored per-operator in the `Operator` model:

```prisma
model Operator {
  payheroUsernameCiphertext   String?
  payheroPasswordCiphertext   String?
  payheroChannelId            Int?
  // ... other fields
}
```

**API Configuration:**

```javascript
POST /api/operators/:id/payment-config
{
  "provider": "payhero",
  "credentials": {
    "username": "operator_username",
    "password": "operator_password",
    "channelId": 12345
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Payment provider configured successfully"
}
```

**Validation:**

- Credentials are validated against the provider API
- Sensitive fields are encrypted before storage
- Configuration status is tracked

#### Future Providers

Future payment providers will follow the same pattern:

1. Add credential fields to the `Operator` model
2. Implement credential validation
3. Add UI configuration fields
4. Store encrypted credentials

### SMS Provider Configuration

SMS providers are also configured per-operator.

#### Database Schema

Add SMS provider fields to the `Operator` model:

```prisma
model Operator {
  // Payment provider fields
  payheroUsernameCiphertext   String?
  payheroPasswordCiphertext   String?
  payheroChannelId            Int?

  // SMS provider fields
  smsProvider                 String?   // "africas-talking", "twilio"
  smsCredentialsCiphertext     String?   // JSON object with provider credentials
  smsSenderId                 String?   // Custom sender ID
  smsEnabled                  Boolean   @default(false)

  // ... other fields
}
```

#### Africa's Talking Configuration

```javascript
POST /api/operators/:id/sms-config
{
  "provider": "africas-talking",
  "credentials": {
    "username": "operator_username",
    "apiKey": "operator_api_key"
  },
  "senderId": "YOUR_SENDER_ID",
  "enabled": true
}
```

#### Twilio Configuration

```javascript
POST /api/operators/:id/sms-config
{
  "provider": "twilio",
  "credentials": {
    "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "authToken": "your_auth_token",
    "messagingServiceSid": "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  },
  "senderId": "+254700000000", // or use messaging service
  "enabled": true
}
```

## Credential Encryption

All operator-level credentials are encrypted using AES-256-GCM:

### Encryption Process

1. Credentials are collected from the operator
2. Sensitive fields are identified
3. Credentials are encrypted using the platform encryption key
4. Encrypted credentials are stored in the database
5. Credentials are decrypted only when needed for API calls

### Encryption Key Sources

The encryption key is derived from (in order of preference):
1. `PAYMENT_CREDENTIALS_KEY` environment variable
2. `SESSION_SECRET` environment variable
3. `JWT_SECRET` environment variable

**Warning:** If the encryption key changes, existing encrypted credentials will become unreadable.

### Credential Masking

When returning operator configuration to the UI:

- Never return decrypted credentials
- Return masked values (e.g., `****` or `****1234`)
- Provide a flag indicating whether credentials are configured
- Allow credential replacement without viewing existing values

## Provider Selection

### Default Provider

The platform has a default provider for each type:

- **Payment:** Daraja (platform-wide)
- **SMS:** Africa's Talking (per-operator)

### Operator Preference

Operators can set their preferred provider:

```javascript
POST /api/operators/:id/provider-preference
{
  "paymentProvider": "payhero",
  "smsProvider": "twilio",
  "fallbackProviders": ["daraja", "africas-talking"]
}
```

### Selection Logic

The platform selects providers based on:

1. **Operator preference** - If operator has configured a preferred provider
2. **Provider availability** - Provider must be enabled and configured
3. **Capability matching** - Provider must support the requested operation
4. **Country support** - Provider must support the target country
5. **Fallback rules** - If primary fails, try fallback providers

## Configuration Validation

### Credential Validation

Before saving credentials, the platform validates them:

```javascript
const adapter = paymentRegistry.getProvider(providerId);
const validation = await adapter.validateCredentials(credentials);

if (!validation.valid) {
  return res.status(400).json({
    success: false,
    errors: validation.errors,
    warnings: validation.warnings
  });
}
```

### Configuration Status

Track configuration status:

```prisma
model Operator {
  paymentConfigStatus      String?   // "configured", "invalid", "not_configured"
  paymentConfigValidatedAt DateTime?
  smsConfigStatus          String?   // "configured", "invalid", "not_configured"
  smsConfigValidatedAt     DateTime?
}
```

## Environment Selection

### Sandbox vs Production

Providers often have sandbox and production environments:

```javascript
POST /api/operators/:id/provider-config
{
  "provider": "payhero",
  "environment": "sandbox", // or "production"
  "credentials": { ... }
}
```

**Platform-level environment:**

```env
# Daraja environment
MPESA_ENV=sandbox
```

**Operator-level environment:**

Stored as part of provider configuration:

```prisma
model Operator {
  payheroEnvironment        String?   // "sandbox" or "production"
  smsEnvironment            String?   // "sandbox" or "production"
}
```

## Configuration API Endpoints

### Get Operator Payment Configuration

```http
GET /api/operators/:id/payment-config
```

**Response:**

```json
{
  "success": true,
  "data": {
    "provider": "payhero",
    "environment": "production",
    "configured": true,
    "status": "configured",
    "validatedAt": "2026-10-21T10:00:00Z",
    "credentials": {
      "username": "****",
      "password": "****",
      "channelId": 12345
    }
  }
}
```

### Set Operator Payment Configuration

```http
POST /api/operators/:id/payment-config
```

**Request Body:**

```json
{
  "provider": "payhero",
  "environment": "production",
  "credentials": {
    "username": "operator_username",
    "password": "operator_password",
    "channelId": 12345
  }
}
```

### Delete Operator Payment Configuration

```http
DELETE /api/operators/:id/payment-config
```

### Get Operator SMS Configuration

```http
GET /api/operators/:id/sms-config
```

### Set Operator SMS Configuration

```http
POST /api/operators/:id/sms-config
```

### Delete Operator SMS Configuration

```http
DELETE /api/operators/:id/sms-config
```

## Configuration UI

### Operator Settings Page

The operator settings page should include:

1. **Payment Provider Section**
   - Provider selection dropdown
   - Environment selection (sandbox/production)
   - Credential input fields
   - Configuration status indicator
   - "Test Configuration" button
   - "Delete Configuration" button

2. **SMS Provider Section**
   - Provider selection dropdown
   - Environment selection
   - Credential input fields
   - Sender ID input field
   - Enable/disable toggle
   - Configuration status indicator
   - "Test SMS" button
   - "Delete Configuration" button

### Configuration Status Indicators

- ✅ **Configured and Valid** - Green checkmark
- ⚠️ **Configured but Invalid** - Yellow warning
- ❌ **Not Configured** - Red X

### Test Configuration Button

Allows operators to test their configuration without making real transactions:

- **Payment providers:** Make a small test payment or check balance
- **SMS providers:** Send a test SMS to a verified number

## Troubleshooting

### Credentials Not Working

1. **Check environment** - Ensure sandbox/production matches
2. **Verify credentials** - Re-enter credentials carefully
3. **Check provider status** - Verify provider API is operational
4. **Check encryption key** - Ensure encryption key hasn't changed
5. **Review logs** - Check error logs for specific issues

### Configuration Validation Fails

1. **Check credential format** - Ensure format matches provider requirements
2. **Check network connectivity** - Ensure platform can reach provider API
3. **Check provider status** - Verify provider account is active
4. **Check API version** - Ensure using correct API version

### Encrypted Credentials Unreadable

1. **Check encryption key** - Verify encryption key hasn't changed
2. **Check key source** - Verify which environment variable is being used
3. **Re-enter credentials** - If key changed, re-enter all credentials

## Security Best Practices

1. **Never log credentials** - Credentials should never appear in logs
2. **Never expose in API responses** - Always mask sensitive fields
3. **Use HTTPS** - All configuration endpoints must use HTTPS
4. **Validate before saving** - Always validate credentials with provider
5. **Rotate credentials regularly** - Encourage operators to rotate credentials
6. **Use strong encryption keys** - Use cryptographically strong keys
7. **Backup encryption key** - Securely backup the encryption key
8. **Monitor configuration changes** - Log all configuration changes
9. **Restrict access** - Only allow authorized users to configure providers
10. **Document procedures** - Document credential rotation procedures

## Migration Guide

### Migrating from Platform-Wide to Per-Operator

For providers currently using platform-wide credentials (like Daraja):

1. Add credential fields to Operator model
2. Create migration script to copy platform credentials to default operator
3. Update payment initiation to use operator credentials when available
4. Fall back to platform credentials if operator not configured
5. Update documentation
6. Test with existing operators

### Credential Rotation

When rotating credentials:

1. Generate new credentials from provider
2. Update configuration via API or UI
3. Test new credentials
4. Verify existing transactions still work
5. Monitor for errors
6. Keep old credentials for a grace period if needed

## Configuration Examples

### Example 1: New Operator with PayHero

```javascript
// Create operator
const operator = await prisma.operator.create({
  data: {
    businessName: "Example WiFi",
    slug: "example-wifi",
    email: "admin@example.com",
    passwordHash: hashedPassword,
  }
});

// Configure PayHero
await configurePaymentProvider(operator.id, {
  provider: "payhero",
  environment: "production",
  credentials: {
    username: "example_user",
    password: "secure_password",
    channelId: 12345
  }
});
```

### Example 2: Operator with Africa's Talking SMS

```javascript
// Configure SMS
await configureSmsProvider(operator.id, {
  provider: "africas-talking",
  environment: "production",
  credentials: {
    username: "example_user",
    apiKey: "secure_api_key"
  },
  senderId: "EXAMPLE",
  enabled: true
});
```

### Example 3: Operator with Multiple Providers

```javascript
// Configure PayHero for payments
await configurePaymentProvider(operator.id, {
  provider: "payhero",
  // ...
});

// Configure Twilio as SMS backup
await configureSmsProvider(operator.id, {
  provider: "twilio",
  // ...
});

// Set provider preferences
await setProviderPreferences(operator.id, {
  paymentProvider: "payhero",
  smsProvider: "africas-talking",
  fallbackProviders: ["twilio"]
});
```

## References

- [Payment Providers](PAYMENT_PROVIDERS.md)
- [SMS Providers](SMS_PROVIDERS.md)
- [Provider Support Matrix](PROVIDER_SUPPORT_MATRIX.md)
- [Webhook Security](WEBHOOK_SECURITY.md)
- [Adding a Provider](../ADDING_A_PROVIDER.md)
