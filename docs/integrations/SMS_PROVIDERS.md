# SMS Providers Documentation

This document describes the SMS provider integrations available in the WiFi Billing System.

## Overview

The platform uses a pluggable architecture for SMS gateways. Each provider implements a common `SmsAdapter` interface, ensuring consistent behavior while allowing provider-specific features.

**Important:** Centipede is **NOT** supported and will not be implemented.

## Supported Providers

### 1. Africa's Talking

**Status:** ✅ Implemented and Production-Ready

**Provider ID:** `africas-talking`

**Official Documentation:** https://docs.africastalking.com/sms

**Supported Countries:** 
- Kenya (KE)
- Uganda (UG)
- Tanzania (TZ)
- Nigeria (NG)
- Rwanda (RW)
- Burundi (BI)
- Ethiopia (ET)
- Mali (ML)
- Senegal (SN)
- Ghana (GH)
- Côte d'Ivoire (CI)
- Cameroon (CM)
- Democratic Republic of Congo (CD)

**Capabilities:**
- ✅ Send SMS
- ✅ Delivery reports
- ✅ Custom sender ID
- ✅ Bulk sending
- ✅ Balance check
- ✅ Scheduled sending
- ✅ Unicode support
- ❌ Flash SMS

**Required Credentials:**
- `username` - Africa's Talking account username
- `apiKey` - API key from dashboard

**Credential Storage:** Per-operator, encrypted at rest

**Sandbox Availability:** ✅ Yes - https://api.sandbox.africastalking.com

**Pricing:** Approximately KES 0.80 per SMS (varies by destination)

**Implementation Status:** Fully implemented

**Notes:**
- Default SMS provider for Kenya
- Supports delivery callbacks
- Balance check API available
- Sender ID registration required for custom sender names

---

### 2. Twilio

**Status:** ✅ Implemented and Production-Ready

**Provider ID:** `twilio`

**Official Documentation:** https://www.twilio.com/docs/sms

**Supported Countries:** Extensive global coverage (200+ countries)

**Capabilities:**
- ✅ Send SMS
- ✅ Delivery reports
- ✅ Custom sender ID (or messaging service)
- ✅ Bulk sending
- ✅ Balance check
- ❌ Scheduled sending (use separate API)
- ✅ Unicode support
- ❌ Flash SMS

**Required Credentials:**
- `accountSid` - Account SID from Twilio console
- `authToken` - Auth token from Twilio console
- `messagingServiceSid` - Optional: Messaging service SID (recommended for production)

**Credential Storage:** Per-operator, encrypted at rest

**Sandbox Availability:** ✅ Yes (test credentials provided)

**Pricing:** Approximately USD 0.05 per SMS (varies by destination)

**Implementation Status:** Fully implemented

**Notes:**
- Global coverage, good for international SMS
- Messaging Service recommended for better deliverability
- Delivery reports via webhook
- Balance check API available
- Sender ID registration required for some countries

---

### 3. Advanta SMS

**Status:** ⏳ Evaluation Required

**Provider ID:** `advanta` (to be assigned)

**Official Documentation:** (To be located and verified)

**Supported Countries:** (To be verified)

**Capabilities:** (To be evaluated)

**Implementation Status:** Not evaluated

**Evaluation Required:**
- Locate and verify official API documentation
- Confirm current API availability
- Check Kenyan coverage
- Verify pricing and reliability
- Test sandbox environment if available

**Note:** This provider was mentioned in existing codebase but needs proper evaluation before implementation.

---

### 4. Mobile Sasa

**Status:** ⏳ Evaluation Required

**Provider ID:** `mobile-sasa` (to be assigned)

**Official Documentation:** (To be located and verified)

**Supported Countries:** (To be verified)

**Capabilities:** (To be evaluated)

**Implementation Status:** Not evaluated

**Evaluation Required:**
- Locate and verify official API documentation
- Confirm current API availability
- Check Kenyan coverage
- Verify pricing and reliability
- Test sandbox environment if available

**Note:** This provider was mentioned in existing codebase but needs proper evaluation before implementation.

---

### 5. Infobip

**Status:** ⏳ Evaluation Required

**Provider ID:** `infobip` (to be assigned)

**Official Documentation:** https://www.infobip.com/docs/api

**Supported Countries:** Global coverage (190+ countries)

**Capabilities:** (To be evaluated)
- Send SMS
- Delivery reports
- Custom sender ID
- Bulk sending
- Balance check
- Scheduled sending
- Unicode support

**Implementation Status:** Not evaluated

**Evaluation Required:**
- Review official API documentation
- Verify Kenyan coverage and sender ID requirements
- Check pricing structure
- Test sandbox environment
- Evaluate against Africa's Talking and Twilio

---

### 6. Vonage (formerly Nexmo)

**Status:** ⏳ Evaluation Required

**Provider ID:** `vonage` (to be assigned)

**Official Documentation:** https://developer.vonage.com/api/sms

**Supported Countries:** Global coverage

**Capabilities:** (To be evaluated)
- Send SMS
- Delivery reports
- Custom sender ID
- Bulk sending
- Balance check
- Unicode support

**Implementation Status:** Not evaluated

**Evaluation Required:**
- Review official API documentation
- Verify Kenyan coverage
- Check pricing structure
- Test sandbox environment
- Evaluate against existing providers

---

## Excluded Providers

### Centipede

**Status:** ❌ **NOT SUPPORTED**

**Reason:** Removed from supported SMS provider catalogue per requirements.

**Action:** If any pre-existing Centipede implementation is discovered, it will be documented and safely deprecated after checking for active usage.

---

## SMS Features

The platform supports the following SMS features where provider capabilities allow:

### Payment Confirmation
- SMS sent when payment is successfully verified
- Includes transaction details and Wi-Fi access duration

### Wi-Fi Package Activation Confirmation
- SMS sent when Wi-Fi access is provisioned
- Includes expiry time and package details

### Package Expiry Reminders
- Optional SMS reminders before package expires
- Configurable timing (e.g., 1 hour before expiry)

### Operator-Approved Customer Notifications
- Custom notifications configured by operators
- Marketing messages, promotions, etc.

### Delivery Status Tracking
- Track delivery status via provider callbacks
- Update delivery status in database
- Handle failed deliveries

### Safe Retry Handling
- Automatic retry for failed sends (configurable limits)
- Exponential backoff for retries
- Prevent notification loops

### Per-Provider Error Reporting
- Normalized error messages
- Provider-specific error codes preserved
- Detailed logging for troubleshooting

### Optional Test Messages
- Test SMS functionality without sending to customers
- Verify provider configuration
- Test sender ID registration

### Usage Visibility and Cost Controls
- Track SMS usage per operator
- Monitor costs per provider
- Set usage limits if needed

## Provider Selection Logic

The platform selects SMS providers based on:

1. **Operator Configuration:** Operators can configure preferred providers
2. **Provider Availability:** Only enabled providers are considered
3. **Country:** Provider must support the destination country
4. **Capability:** Provider must support required features (e.g., sender ID)
5. **Fallback Rules:** Configurable fallback when primary provider fails
6. **Cost:** Optional cost-based routing (if pricing data available)

### Default Provider

- **Africa's Talking** is the default SMS provider for Kenya
- **Twilio** is available as a fallback or for international SMS
- Future providers can be set as default via registry configuration

## Security Considerations

### Credential Storage
- All SMS provider credentials are stored per-operator
- Credentials are encrypted at rest using AES-256-GCM
- Credentials are never logged or exposed in API responses

### Rate Limiting
- Platform-level rate limiting on SMS endpoints
- Per-operator rate limits configurable
- Provider-specific rate limits respected

### Content Validation
- Message content validation before sending
- Phone number validation and normalization
- Sender ID validation where required

### Delivery Callbacks
- Callback signature verification where supported
- Replay attack prevention
- Timestamp validation

## Reliability Considerations

### Failed SMS Handling
- Failed SMS delivery **never** reverses a verified payment
- Failed SMS delivery **never** blocks Wi-Fi provisioning
- SMS failures are logged separately from payment status

### Retry Logic
- Configurable retry attempts (default: 3)
- Exponential backoff between retries
- Maximum retry duration (default: 1 hour)

### Delivery Tracking
- Delivery status updated via callbacks
- Manual status check for providers without callbacks
- Failed delivery alerts to operators

## Testing

### Sandbox Testing
- **Africa's Talking:** Sandbox available
- **Twilio:** Test credentials available
- **Future providers:** Sandbox testing required before production

### Test Procedures

See `docs/integrations/PROVIDER_TESTING.md` for detailed testing procedures.

## Troubleshooting

See `docs/integrations/TROUBLESHOOTING.md` for common issues and solutions.

## Adding a New Provider

See `docs/ADDING_A_PROVIDER.md` for step-by-step instructions on adding a new SMS provider.

## Provider Support Matrix

See `docs/integrations/PROVIDER_SUPPORT_MATRIX.md` for a comprehensive comparison of all providers.
