# Payment Providers Documentation

This document describes the payment provider integrations available in the WiFi Billing System.

## Overview

The platform uses a pluggable architecture for payment gateways. Each provider implements a common `PaymentAdapter` interface, ensuring consistent behavior while allowing provider-specific features.

## Supported Providers

### 1. Safaricom M-Pesa Daraja

**Status:** ✅ Implemented and Production-Ready

**Provider ID:** `daraja`

**Official Documentation:** https://developer.safaricom.co.ke/apis

**Supported Countries:** Kenya (KE)

**Supported Payment Methods:**
- M-Pesa STK Push

**Capabilities:**
- ✅ Payment initiation
- ✅ Webhook callbacks
- ❌ Transaction status queries (not supported by Daraja)
- ❌ Refunds (contact Safaricom directly)
- ❌ Idempotency (not supported by Daraja API)

**Required Credentials:**
- `consumerKey` - From Safaricom Developer Portal
- `consumerSecret` - From Safaricom Developer Portal
- `shortcode` - M-Pesa Paybill or Till Number
- `passkey` - From Safaricom Developer Portal

**Environment Variables:**
```env
MPESA_ENV=sandbox  # or "production"
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/mpesa/callback
```

**Sandbox Availability:** ✅ Yes - https://sandbox.safaricom.co.ke

**Implementation Status:** Migrated to adapter pattern, maintains backward compatibility

**Notes:**
- Daraja credentials are platform-wide (not per-operator)
- Webhook signature verification is limited (Daraja doesn't use HMAC)
- STK Push timeouts are handled by the platform
- No transaction status query API available

---

### 2. PayHero

**Status:** ✅ Implemented and Production-Ready

**Provider ID:** `payhero`

**Official Documentation:** https://payhero.co.ke/developers

**Supported Countries:** Kenya (KE)

**Supported Payment Methods:**
- M-Pesa

**Capabilities:**
- ✅ Payment initiation
- ✅ Webhook callbacks
- ✅ Transaction status queries
- ❌ Refunds (contact PayHero support)
- ❌ Idempotency

**Required Credentials:**
- `username` - PayHero account username
- `password` - PayHero account password
- `channelId` - Payment channel ID

**Credential Storage:** Per-operator, encrypted at rest

**Sandbox Availability:** ✅ Yes

**Implementation Status:** Migrated to adapter pattern, maintains backward compatibility

**Notes:**
- Credentials are stored per-operator and encrypted
- Supports authoritative transaction status verification
- Webhook signature verification not implemented (PayHero doesn't use HMAC)

---

### 3. Pesapal

**Status:** ⏳ Planned

**Provider ID:** `pesapal` (to be assigned)

**Official Documentation:** https://www.pesapal.com/api-documentation

**Supported Countries:** Kenya (KE), Uganda (UG), Zambia (ZM), Malawi (MW)

**Supported Payment Methods:** (To be evaluated)
- M-Pesa
- Card payments (Visa, Mastercard)
- Bank transfer
- Mobile money (Airtel, Tigo)

**Capabilities:** (To be evaluated)
- Payment initiation
- Webhook callbacks
- Transaction status queries
- Refunds (to be verified)

**Required Credentials:** (To be documented after API review)

**Implementation Status:** Not yet implemented

**Evaluation Required:**
- Review official API documentation
- Confirm merchant onboarding process
- Verify webhook signature mechanism
- Test sandbox environment
- Document supported payment methods

---

### 4. Flutterwave

**Status:** ⏳ Evaluation Required

**Provider ID:** `flutterwave` (to be assigned)

**Official Documentation:** https://developer.flutterwave.com/docs

**Supported Countries:** Multiple African countries

**Supported Payment Methods:** (To be evaluated)
- M-Pesa
- Card payments
- Bank transfer
- Mobile money

**Capabilities:** (To be evaluated)

**Implementation Status:** Not evaluated

**Evaluation Required:**
- Review official API documentation
- Confirm Kenyan merchant eligibility
- Verify M-Pesa integration support
- Check settlement arrangements
- Document fees and limitations

---

### 5. IntaSend

**Status:** ⏳ Evaluation Required

**Provider ID:** `intasend` (to be assigned)

**Official Documentation:** https://intasend.com/docs

**Supported Countries:** Kenya (KE)

**Supported Payment Methods:** (To be evaluated)

**Implementation Status:** Not evaluated

**Evaluation Required:**
- Review official API documentation
- Verify Kenyan payment methods
- Test sandbox environment
- Document capabilities

---

### 6. Paystack

**Status:** ⏳ Evaluation Required

**Provider ID:** `paystack` (to be assigned)

**Official Documentation:** https://paystack.com/docs

**Supported Countries:** Nigeria (NG), Ghana (GH), South Africa (ZA)

**Supported Payment Methods:** (To be evaluated)

**Implementation Status:** Not evaluated

**Evaluation Required:**
- **Critical:** Verify merchant eligibility in Kenya
- Paystack primarily serves West African markets
- Confirm if Kenya is supported
- If not supported, document as ineligible for this platform

---

### 7. Airtel Money

**Status:** ⏳ Evaluation Required

**Provider ID:** `airtel-money` (to be assigned)

**Official Documentation:** (To be located)

**Supported Countries:** Multiple African countries

**Implementation Status:** Not evaluated

**Evaluation Required:**
- Locate official API documentation
- Verify direct integration availability
- Confirm merchant onboarding process
- Check Kenyan availability

---

### 8. Cellulant Tingg

**Status:** ⏳ Evaluation Required

**Provider ID:** `tingg` (to be assigned)

**Official Documentation:** (To be located)

**Supported Countries:** Multiple African countries

**Implementation Status:** Not evaluated

**Evaluation Required:**
- Locate official API documentation
- Verify merchant onboarding requirements
- Check supported collection methods
- Confirm Kenyan availability

---

## Provider Selection Logic

The platform selects payment providers based on:

1. **Operator Configuration:** Operators can configure preferred providers
2. **Provider Availability:** Only enabled providers are considered
3. **Payment Method:** Provider must support the requested payment method
4. **Country:** Provider must operate in the target country
5. **Fallback Rules:** Configurable fallback when primary provider fails

### Default Provider

- **Daraja** is the default payment provider for platform-wide payments
- **PayHero** is used when configured per-operator
- Future providers can be set as default via registry configuration

## Security Considerations

### Webhook Verification

- **Daraja:** Limited signature verification (no HMAC)
- **PayHero:** No signature verification (no HMAC)
- **Future providers:** Must implement HMAC signature verification

### Idempotency

- **Daraja:** Not supported by API
- **PayHero:** Not supported by API
- **Platform-level:** Idempotency keys are generated and tracked by the platform

### Credential Storage

- **Daraja:** Platform-wide environment variables
- **PayHero:** Per-operator encrypted storage
- **Future providers:** Should use per-operator encrypted storage

## Testing

### Sandbox Testing

- **Daraja:** Sandbox available at https://sandbox.safaricom.co.ke
- **PayHero:** Sandbox available
- **Future providers:** Sandbox testing required before production deployment

### Test Procedures

See `docs/integrations/PROVIDER_TESTING.md` for detailed testing procedures.

## Troubleshooting

See `docs/integrations/TROUBLESHOOTING.md` for common issues and solutions.

## Adding a New Provider

See `docs/ADDING_A_PROVIDER.md` for step-by-step instructions on adding a new payment provider.

## Provider Support Matrix

See `docs/integrations/PROVIDER_SUPPORT_MATRIX.md` for a comprehensive comparison of all providers.
