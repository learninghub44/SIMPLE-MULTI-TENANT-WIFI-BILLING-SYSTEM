/**
 * Payment Adapter Contract
 * 
 * All payment providers must implement this interface to ensure
 * consistent behavior across different payment gateways.
 */

/**
 * @typedef {Object} PaymentProviderMetadata
 * @property {string} providerId - Unique identifier for the provider (e.g., "daraja", "payhero")
 * @property {string} displayName - Human-readable name
 * @property {string[]} supportedCountries - ISO country codes where provider operates
 * @property {PaymentMethod[]} supportedMethods - Payment methods supported
 * @property {CapabilityFlags} capabilities - Feature flags for supported operations
 * @property {CredentialField[]} requiredCredentials - Credential fields required for configuration
 * @property {boolean} requiresWebhook - Whether provider requires webhook configuration
 * @property {string} documentationUrl - Link to official API documentation
 * @property {string} sandboxUrl - Sandbox/test environment URL
 * @property {string} productionUrl - Production environment URL
 */

/**
 * @typedef {Object} PaymentMethod
 * @property {string} id - Method identifier (e.g., "mpesa_stk", "card", "bank_transfer")
 * @property {string} displayName - Human-readable method name
 * @property {string[]} supportedCurrencies - Currency codes (e.g., ["KES", "USD"])
 * @property {Object} limits - Min/max amounts per transaction
 * @property {number} limits.minAmount - Minimum amount in smallest currency unit
 * @property {number} limits.maxAmount - Maximum amount in smallest currency unit
 */

/**
 * @typedef {Object} CapabilityFlags
 * @property {boolean} initiatePayment - Can initiate payment requests
 * @property {boolean} verifyCallback - Can verify webhook signatures
 * @property {boolean} checkStatus - Can query transaction status
 * @property {boolean} refund - Can process refunds
 * @property {boolean} idempotency - Supports idempotency keys
 * @property {boolean} webhooks - Supports webhook callbacks
 * @property {boolean} preAuth - Supports pre-authorization
 */

/**
 * @typedef {Object} CredentialField
 * @property {string} key - Field identifier (e.g., "apiKey", "secret")
 * @property {string} displayName - Human-readable field name
 * @property {string} type - Field type: "string", "number", "boolean"
 * @property {boolean} required - Whether field is mandatory
 * @property {boolean} sensitive - Whether field should be encrypted
 * @property {string} [placeholder] - Example or placeholder value
 * @property {string} [description] - Field description
 */

/**
 * @typedef {Object} PaymentInitiationRequest
 * @property {number} amount - Payment amount in smallest currency unit
 * @property {string} currency - Currency code (e.g., "KES")
 * @property {string} phone - Customer phone number
 * @property {string} transactionId - Internal transaction ID
 * @property {string} [idempotencyKey] - Optional idempotency key
 * @property {Object} [metadata] - Additional provider-specific metadata
 * @property {string} callbackUrl - Webhook callback URL
 */

/**
 * @typedef {Object} PaymentInitiationResult
 * @property {boolean} success - Whether initiation succeeded
 * @property {string} providerReference - Provider's transaction reference
 * @property {string} [checkoutId] - Checkout request ID (for STK push etc.)
 * @property {string} status - Initial status: "pending", "processing", or "failed"
 * @property {Object} [raw] - Raw provider response for debugging
 * @property {string} [errorMessage] - Error message if failed
 */

/**
 * @typedef {Object} CallbackVerificationResult
 * @property {boolean} valid - Whether callback signature is valid
 * @property {string} [transactionId] - Extracted transaction ID
 * @property {string} [providerReference] - Provider's reference
 * @property {string} [status] - Payment status from callback
 * @property {number} [amount] - Payment amount
 * @property {string} [receipt] - Receipt or transaction ID
 * @property {string} [errorMessage] - Error message if invalid
 */

/**
 * @typedef {Object} TransactionStatusResult
 * @property {boolean} success - Whether status check succeeded
 * @property {string} status - Normalized status: "pending", "completed", "failed", "unknown"
 * @property {number} [amount] - Confirmed amount
 * @property {string} [receipt] - Provider receipt/transaction ID
 * @property {Object} [raw] - Raw provider response
 * @property {string} [errorMessage] - Error message if failed
 */

/**
 * @typedef {Object} RefundResult
 * @property {boolean} success - Whether refund succeeded
 * @property {string} [refundId] - Provider's refund reference
 * @property {string} status - Refund status: "pending", "completed", "failed"
 * @property {Object} [raw] - Raw provider response
 * @property {string} [errorMessage] - Error message if failed
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether credentials are valid
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

class PaymentAdapter {
  /**
   * Get provider metadata
   * @returns {PaymentProviderMetadata}
   */
  getMetadata() {
    throw new Error('getMetadata must be implemented by subclass');
  }

  /**
   * Validate provider credentials
   * @param {Object} credentials - Provider credentials object
   * @returns {Promise<ValidationResult>}
   */
  async validateCredentials(credentials) {
    throw new Error('validateCredentials must be implemented by subclass');
  }

  /**
   * Initiate a payment
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {PaymentInitiationRequest} request - Payment initiation request
   * @returns {Promise<PaymentInitiationResult>}
   */
  async initiatePayment(operatorConfig, request) {
    throw new Error('initiatePayment must be implemented by subclass');
  }

  /**
   * Verify webhook callback signature
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {Object} headers - HTTP headers from callback
   * @param {Object} body - Callback request body
   * @returns {Promise<CallbackVerificationResult>}
   */
  async verifyCallback(operatorConfig, headers, body) {
    throw new Error('verifyCallback must be implemented by subclass');
  }

  /**
   * Check transaction status
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {string} providerReference - Provider's transaction reference
   * @returns {Promise<TransactionStatusResult>}
   */
  async checkStatus(operatorConfig, providerReference) {
    throw new Error('checkStatus must be implemented by subclass');
  }

  /**
   * Normalize provider status to internal status
   * @param {string} providerStatus - Provider's raw status
   * @returns {string} - Normalized status: "pending", "completed", "failed", "unknown"
   */
  normalizeStatus(providerStatus) {
    throw new Error('normalizeStatus must be implemented by subclass');
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
    throw new Error('Refunds not supported by this provider');
  }

  /**
   * Check if provider supports a specific capability
   * @param {string} capability - Capability name from CapabilityFlags
   * @returns {boolean}
   */
  supportsCapability(capability) {
    const metadata = this.getMetadata();
    return Boolean(metadata.capabilities[capability]);
  }

  /**
   * Check if provider supports a specific payment method
   * @param {string} methodId - Payment method ID
   * @returns {boolean}
   */
  supportsMethod(methodId) {
    const metadata = this.getMetadata();
    return metadata.supportedMethods.some(method => method.id === methodId);
  }

  /**
   * Check if provider operates in a specific country
   * @param {string} countryCode - ISO country code
   * @returns {boolean}
   */
  supportsCountry(countryCode) {
    const metadata = this.getMetadata();
    return metadata.supportedCountries.includes(countryCode.toUpperCase());
  }
}

module.exports = PaymentAdapter;
