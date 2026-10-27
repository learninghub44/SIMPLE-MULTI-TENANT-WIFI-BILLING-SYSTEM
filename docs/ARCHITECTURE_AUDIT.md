# Architecture Audit: Payment and SMS Integrations

**Date:** 2026-10-21  
**Repository:** SIMPLE-MULTI-TENANT-WIFI-BILLING-SYSTEM

## Executive Summary

This document audits the existing payment and SMS integration architecture to inform the design of a pluggable, provider-independent system.

## Current State

### Payment Integrations

#### 1. Daraja (Safaricom M-Pesa)

**Location:** `config/mpesa.js`

**Capabilities:**
- STK Push for M-Pesa payments
- OAuth token generation
- Environment-based configuration (sandbox/production)

**Credentials:**
- Platform-wide environment variables:
  - `MPESA_CONSUMER_KEY`
  - `MPESA_CONSUMER_SECRET`
  - `MPESA_SHORTCODE`
  - `MPESA_PASSKEY`
  - `MPESA_CALLBACK_URL`

**Callback Handling:**
- Location: `routes/mpesaCallback.js`
- Processes STK Push callbacks
- Handles both Wi-Fi payments and loan repayments
- No webhook signature verification
- No idempotency handling

**Issues:**
- Credentials are platform-wide, not per-operator
- No signature verification on callbacks
- No idempotency to prevent duplicate processing
- Tightly coupled to payment routes

#### 2. PayHero

**Location:** `services/payhero.js`

**Capabilities:**
- Payment initiation via PayHero API
- Transaction status inquiry
- M-Pesa provider support

**Credentials:**
- Operator-specific encrypted credentials:
  - `payheroUsernameCiphertext`
  - `payheroPasswordCiphertext`
  - `payheroChannelId`
- Encryption handled by `services/credentialCrypto.js`

**Callback Handling:**
- Location: `routes/payheroCallback.js`
- Verifies operator ownership
- Validates amount matching
- Performs authoritative status check via PayHero API
- No webhook signature verification

**Issues:**
- No signature verification on callbacks
- No idempotency handling
- Tightly coupled to payment routes

### SMS Integrations

**Status:** **NOT IMPLEMENTED**

- No SMS providers currently exist in the codebase
- Centipede was searched for and not found (as required by addendum)
- No SMS notification system exists
- No SMS-related database fields

### Database Schema

#### Payment Model (`prisma/schema.prisma`)

```prisma
model Payment {
  id                  Int      @id @default(autoincrement())
  phone               String
  amount              Int
  transactionId       String   @unique
  macAddress          String
  status              String
  provider            String   @default("daraja")
  providerReference   String?
  providerCheckoutId  String?
  providerReceipt     String?
  accessStatus        String   @default("pending")
  timePurchased       DateTime @default(now())
  mpesaRef            String?
  expiresAt           DateTime?
  operatorId          Int?
  operator            Operator? @relation(fields: [operatorId], references: [id], onDelete: SetNull)
  userId              Int?
  user                User?    @relation(fields: [userId], references: [id])
  authUserId          Int?
  authUser            AuthUser? @relation(fields: [authUserId], references: [id])

  @@index([operatorId, timePurchased])
  @@index([provider, providerReference])
}
```

**Observations:**
- `provider` field exists but is a free-form string
- Provider-specific fields (`providerReference`, `providerCheckoutId`, `providerReceipt`) are generic
- No dedicated provider configuration table
- No webhook signature storage
- No idempotency key storage

#### Operator Model

```prisma
model Operator {
  id                          Int       @id @default(autoincrement())
  businessName                String
  slug                        String    @unique
  email                       String    @unique
  passwordHash                String
  status                      String    @default("active")
  payheroUsernameCiphertext   String?
  payheroPasswordCiphertext   String?
  payheroChannelId            Int?
  mikrotikHost                String?
  mikrotikUsernameCiphertext  String?
  mikrotikPasswordCiphertext  String?
  mikrotikPort                Int?
  createdAt                   DateTime  @default(now())
  updatedAt                   DateTime  @updatedAt
  payments                    Payment[]
}
```

**Observations:**
- PayHero credentials are operator-specific and encrypted
- MikroTik credentials are also operator-specific and encrypted
- No generic provider credential storage
- Adding a new provider requires schema changes

### Credential Encryption

**Location:** `services/credentialCrypto.js`

**Implementation:**
- AES-256-GCM encryption
- HKDF key derivation from master secret
- Master secret sources (in order of preference):
  1. `PAYMENT_CREDENTIALS_KEY`
  2. `SESSION_SECRET`
  3. `JWT_SECRET`
- Versioned ciphertext format (v1)
- IV and auth tag stored with ciphertext

**Strengths:**
- Strong encryption algorithm
- Key derivation prevents direct use of secrets
- Versioned format allows future migration

**Issues:**
- No validation that master secret is strong enough
- No credential rotation mechanism
- Tied to specific provider fields (not generic)

### Payment Flow

#### Current Wi-Fi Payment Flow

1. **Initiation** (`routes/mpesaRoutes.js`):
   - Validates phone, amount, MAC address
   - Checks operator configuration
   - Selects provider (PayHero if configured, otherwise Daraja)
   - Creates payment record with `status: "pending"`
   - Calls provider-specific initiation
   - Updates payment with provider references

2. **Callback Processing**:
   - Daraja: `routes/mpesaCallback.js`
   - PayHero: `routes/payheroCallback.js`
   - Validates callback data
   - Updates payment status
   - Calls `services/paymentCompletion.js` to provision Wi-Fi

3. **Wi-Fi Provisioning** (`services/paymentCompletion.js`):
   - Calculates expiry based on amount
   - Updates payment with completion details
   - Whitelists MAC address on MikroTik
   - Updates payment `accessStatus`

**Issues:**
- Provider selection logic is hardcoded in routes
- No fallback strategy
- Callback handlers are provider-specific
- No unified error handling
- No retry logic

## Architecture Gaps

### 1. No Common Adapter Interface
- Each provider has its own implementation pattern
- No standardized methods for initiation, status checking, callback handling
- Difficult to add new providers without modifying core logic

### 2. No Provider Registry
- Providers are hardcoded in route logic
- No dynamic provider discovery
- No capability declaration system
- Cannot enable/disable providers at runtime

### 3. Insecure Callback Handling
- No webhook signature verification for any provider
- Vulnerable to fake payment notifications
- No replay attack prevention
- No timestamp validation

### 4. No Idempotency
- Duplicate callbacks can cause duplicate payments
- No idempotency keys in payment records
- No request deduplication

### 5. Tight Coupling
- Payment routes directly call provider-specific code
- Business logic mixed with provider integration
- Difficult to test providers in isolation

### 6. No SMS System
- No SMS provider infrastructure
- No notification system
- No delivery tracking
- No cost controls

### 7. Limited Credential Management
- Only PayHero uses encrypted per-operator credentials
- Daraja uses platform-wide credentials
- No generic credential storage
- No credential validation

### 8. No Observability
- Limited logging of provider interactions
- No metrics on provider performance
- No error tracking per provider
- No audit trail for provider operations

## Recommendations

### Immediate Actions

1. **Create Payment Adapter Contract**
   - Define standard interface for payment providers
   - Include methods: `initiate`, `verifyCallback`, `checkStatus`, `normalizeStatus`
   - Declare capabilities explicitly

2. **Create SMS Adapter Contract**
   - Define standard interface for SMS providers
   - Include methods: `send`, `normalizeResult`
   - Support delivery callbacks where available

3. **Implement Provider Registry**
   - Dynamic provider registration
   - Capability-based provider selection
   - Runtime enable/disable

4. **Add Webhook Security**
   - Signature verification for all providers
   - Replay attack prevention
   - Timestamp validation

5. **Add Idempotency**
   - Idempotency keys for all payment requests
   - Deduplication of callbacks
   - Idempotent status checks

6. **Migrate Existing Providers**
   - Refactor Daraja to use adapter pattern
   - Refactor PayHero to use adapter pattern
   - Preserve existing functionality
   - Add missing security features

### Long-term Improvements

1. **Generic Credential Storage**
   - JSON-based credential fields
   - Provider-specific credential schemas
   - Validation per provider

2. **SMS Notification System**
   - Implement Africa's Talking as first SMS provider
   - Add Twilio as second SMS provider
   - Build notification routing
   - Add delivery tracking

3. **Observability**
   - Structured logging for all provider operations
   - Metrics collection
   - Error tracking
   - Audit logging

4. **Fallback Strategy**
   - Configurable fallback rules
   - Safe fallback conditions
   - Fallback audit trail

5. **Testing Infrastructure**
   - Mock provider responses
   - Integration test suite
   - Sandbox test procedures
   - Load testing

## Migration Strategy

### Phase 1: Foundation (Non-breaking)
- Create adapter contracts
- Implement provider registry
- Add webhook security utilities
- Add idempotency utilities

### Phase 2: Migration (Backward Compatible)
- Migrate Daraja to adapter pattern
- Migrate PayHero to adapter pattern
- Maintain existing route compatibility
- Add new adapter-based routes alongside old ones

### Phase 3: New Providers
- Implement Pesapal adapter
- Implement Africa's Talking SMS adapter
- Implement Twilio SMS adapter
- Add operator configuration UI

### Phase 4: Cleanup
- Deprecate old routes
- Remove provider-specific code from routes
- Consolidate credential storage
- Update documentation

## Conclusion

The current architecture has working payment integrations but lacks the modularity, security, and extensibility required for a pluggable provider system. The existing credential encryption for PayHero provides a good foundation for per-operator credential management. However, significant refactoring is needed to achieve the goals outlined in the addendum.

The absence of any SMS infrastructure means this will be a greenfield implementation, which simplifies the design as we can apply best practices from the start.
