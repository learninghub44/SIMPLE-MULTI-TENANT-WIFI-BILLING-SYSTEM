# Provider Support Matrix

This document provides a comprehensive comparison of all payment and SMS providers.

## Payment Providers

| Provider | ID | Status | Countries | Methods | Initiate | Callbacks | Status Check | Refunds | Idempotency | Sandbox | Notes |
|----------|-----|--------|-----------|---------|----------|-----------|--------------|---------|-------------|---------|-------|
| Safaricom Daraja | `daraja` | ✅ Implemented | KE | M-Pesa STK | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | Platform-wide credentials |
| PayHero | `payhero` | ✅ Implemented | KE | M-Pesa | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Per-operator credentials |
| Pesapal | `pesapal` | ⏳ Planned | KE, UG, ZM, MW | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Evaluation required |
| Flutterwave | `flutterwave` | ⏳ Eval Required | Multiple | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Kenyan eligibility TBD |
| IntaSend | `intasend` | ⏳ Eval Required | KE | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Evaluation required |
| Paystack | `paystack` | ⏳ Eval Required | NG, GH, ZA | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Kenya support TBD |
| Airtel Money | `airtel-money` | ⏳ Eval Required | Multiple | TBD | TBD | TBD | TBD | TBD | TBD | TBD | API docs TBD |
| Cellulant Tingg | `tingg` | ⏳ Eval Required | Multiple | TBD | TBD | TBD | TBD | TBD | TBD | TBD | API docs TBD |

## SMS Providers

| Provider | ID | Status | Countries | Send | Delivery Reports | Sender ID | Bulk | Balance Check | Scheduled | Unicode | Sandbox | Pricing (approx) |
|----------|-----|--------|-----------|------|------------------|-----------|------|---------------|-----------|---------|---------|-----------------|
| Africa's Talking | `africas-talking` | ✅ Implemented | 13+ African | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | KES 0.80/SMS |
| Twilio | `twilio` | ✅ Implemented | 200+ Global | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | USD 0.05/SMS |
| Advanta SMS | `advanta` | ⏳ Eval Required | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Mobile Sasa | `mobile-sasa` | ⏳ Eval Required | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Infobip | `infobip` | ⏳ Eval Required | 190+ Global | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Vonage | `vonage` | ⏳ Eval Required | Global | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Centipede | `centipede` | ❌ **NOT SUPPORTED** | N/A | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/A |

## Payment Provider Credential Requirements

### Daraja
| Credential | Type | Required | Sensitive | Storage |
|------------|------|----------|-----------|---------|
| consumerKey | string | ✅ | ✅ | Environment variable |
| consumerSecret | string | ✅ | ✅ | Environment variable |
| shortcode | string | ✅ | ❌ | Environment variable |
| passkey | string | ✅ | ✅ | Environment variable |

### PayHero
| Credential | Type | Required | Sensitive | Storage |
|------------|------|----------|-----------|---------|
| username | string | ✅ | ✅ | Per-operator encrypted |
| password | string | ✅ | ✅ | Per-operator encrypted |
| channelId | number | ✅ | ❌ | Per-operator encrypted |

## SMS Provider Credential Requirements

### Africa's Talking
| Credential | Type | Required | Sensitive | Storage |
|------------|------|----------|-----------|---------|
| username | string | ✅ | ❌ | Per-operator encrypted |
| apiKey | string | ✅ | ✅ | Per-operator encrypted |

### Twilio
| Credential | Type | Required | Sensitive | Storage |
|------------|------|----------|-----------|---------|
| accountSid | string | ✅ | ✅ | Per-operator encrypted |
| authToken | string | ✅ | ✅ | Per-operator encrypted |
| messagingServiceSid | string | ❌ | ❌ | Per-operator encrypted |

## Payment Provider API Endpoints

### Daraja
| Environment | Base URL |
|------------|----------|
| Sandbox | https://sandbox.safaricom.co.ke |
| Production | https://api.safaricom.co.ke |

### PayHero
| Environment | Base URL |
|------------|----------|
| Sandbox | https://backend.payhero.co.ke/api/v2 |
| Production | https://backend.payhero.co.ke/api/v2 |

## SMS Provider API Endpoints

### Africa's Talking
| Environment | Base URL |
|------------|----------|
| Sandbox | https://api.sandbox.africastalking.com/version1 |
| Production | https://api.africastalking.com/version1 |

### Twilio
| Environment | Base URL |
|------------|----------|
| Sandbox | https://api.twilio.com |
| Production | https://api.twilio.com |

## Implementation Status Legend

- ✅ **Implemented** - Fully implemented and tested
- ⏳ **Planned** - Planned for implementation
- ⏳ **Eval Required** - Evaluation required before implementation
- ❌ **Not Supported** - Explicitly not supported
- TBD **To Be Determined** - Information not yet available

## Evaluation Checklist

For each provider marked as "Eval Required", the following must be completed:

- [ ] Locate and review official API documentation
- [ ] Confirm supported countries and regions
- [ ] Verify merchant onboarding requirements
- [ ] Document supported payment/SMS methods
- [ ] Identify credential requirements
- [ ] Verify webhook/callback mechanism
- [ ] Check sandbox availability
- [ ] Document fees and commercial limitations
- [ ] Test sandbox environment
- [ ] Evaluate against existing providers
- [ ] Recommend implementation or rejection

## Priority Implementation Order

1. **High Priority** (Already Complete)
   - ✅ Daraja adapter migration
   - ✅ PayHero adapter migration
   - ✅ Africa's Talking SMS adapter
   - ✅ Twilio SMS adapter

2. **Medium Priority** (Next Phase)
   - ⏳ Pesapal payment adapter
   - ⏳ Operator configuration UI
   - ⏳ Integration tests

3. **Low Priority** (Future)
   - ⏳ Flutterwave evaluation
   - ⏳ IntaSend evaluation
   - ⏳ Infobip SMS evaluation
   - ⏳ Vonage SMS evaluation

4. **Conditional** (Based on Evaluation)
   - ⏳ Paystack (only if Kenya is supported)
   - ⏳ Airtel Money (only if direct integration available)
   - ⏳ Cellulant Tingg (only if API is suitable)
   - ⏳ Advanta SMS (only if API is suitable)
   - ⏳ Mobile Sasa (only if API is suitable)

## Known Limitations

### Payment Providers
- **Daraja:** No transaction status query API, limited webhook security
- **PayHero:** No webhook signature verification, no refunds
- **All providers:** Platform-level idempotency required (most don't support native idempotency)

### SMS Providers
- **Africa's Talking:** Sender ID registration required
- **Twilio:** Messaging Service recommended for production
- **All providers:** Failed SMS delivery doesn't affect payment status

## Security Matrix

| Provider | Webhook Signature | Idempotency | Credential Encryption | Replay Protection |
|----------|-------------------|-------------|----------------------|-------------------|
| Daraja | ❌ Limited | ❌ | N/A (platform-wide) | ⏳ Platform-level |
| PayHero | ❌ No | ❌ | ✅ AES-256-GCM | ⏳ Platform-level |
| Africa's Talking | ⏳ TBD | ⏳ TBD | ✅ AES-256-GCM | ⏳ Platform-level |
| Twilio | ✅ Available | ⏳ TBD | ✅ AES-256-GCM | ⏳ Platform-level |

## Cost Comparison

### Payment Providers
- **Daraja:** Transaction fees charged by Safaricom (typically 0.5-1%)
- **PayHero:** Transaction fees charged by PayHero (TBD)
- **Pesapal:** TBD (to be documented)
- **Others:** TBD (to be documented)

### SMS Providers
- **Africa's Talking:** ~KES 0.80 per SMS (varies by destination)
- **Twilio:** ~USD 0.05 per SMS (varies by destination)
- **Others:** TBD (to be documented)

## Notes

1. **Centipede is explicitly not supported** per requirements
2. **Paystack Kenya support must be verified** before implementation
3. **All new providers must implement webhook signature verification** if supported by the API
4. **Per-operator credential encryption is required** for all new providers
5. **Sandbox testing is mandatory** before production deployment
6. **Documentation must be updated** with actual capabilities after evaluation
