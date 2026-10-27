/**
 * SMS Adapter Contract
 * 
 * All SMS providers must implement this interface to ensure
 * consistent behavior across different SMS gateways.
 */

/**
 * @typedef {Object} SmsProviderMetadata
 * @property {string} providerId - Unique identifier for the provider (e.g., "africas-talking", "twilio")
 * @property {string} displayName - Human-readable name
 * @property {string[]} supportedCountries - ISO country codes where provider operates
 * @property {SmsCapabilityFlags} capabilities - Feature flags for supported operations
 * @property {CredentialField[]} requiredCredentials - Credential fields required for configuration
 * @property {string} documentationUrl - Link to official API documentation
 * @property {string} sandboxUrl - Sandbox/test environment URL (if available)
 * @property {string} productionUrl - Production environment URL
 * @property {Object} pricing - Pricing information (if publicly documented)
 * @property {string} [pricing.perSms] - Cost per SMS in USD (approximate)
 * @property {string} [pricing.currency] - Currency for pricing
 */

/**
 * @typedef {Object} SmsCapabilityFlags
 * @property {boolean} sendSms - Can send SMS messages
 * @property {boolean} deliveryReports - Supports delivery status callbacks
 * @property {boolean} senderId - Supports custom sender IDs
 * @property {boolean} bulkSend - Can send bulk messages
 * @property {boolean} balanceCheck - Can check account balance
 * @property {boolean} scheduledSend - Can schedule messages for later
 * @property {boolean} unicode - Supports Unicode characters
 * @property {boolean} flashSms - Supports flash messages
 */

/**
 * @typedef {Object} CredentialField
 * @property {string} key - Field identifier (e.g., "apiKey", "username")
 * @property {string} displayName - Human-readable field name
 * @property {string} type - Field type: "string", "number", "boolean"
 * @property {boolean} required - Whether field is mandatory
 * @property {boolean} sensitive - Whether field should be encrypted
 * @property {string} [placeholder] - Example or placeholder value
 * @property {string} [description] - Field description
 */

/**
 * @typedef {Object} SmsMessage
 * @property {string} to - Recipient phone number (E.164 format)
 * @property {string} message - Message content
 * @property {string} [senderId] - Custom sender ID (if supported)
 * @property {string} [idempotencyKey] - Optional idempotency key
 * @property {Object} [metadata] - Additional provider-specific metadata
 */

/**
 * @typedef {Object} SmsSendResult
 * @property {boolean} success - Whether send succeeded
 * @property {string} messageId - Provider's message ID
 * @property {string} status - Initial status: "queued", "sent", "failed"
 * @property {number} [cost] - Cost of message in provider's currency
 * @property {string} [currency] - Currency code for cost
 * @property {Object} [raw] - Raw provider response for debugging
 * @property {string} [errorMessage] - Error message if failed
 * @property {string} [errorCode] - Provider-specific error code
 */

/**
 * @typedef {Object} DeliveryReport
 * @property {string} messageId - Provider's message ID
 * @property {string} status - Delivery status: "delivered", "failed", "pending", "unknown"
 * @property {Date} [deliveredAt] - Timestamp when delivered
 * @property {string} [failureReason] - Reason for failure if applicable
 * @property {Object} [raw] - Raw provider response
 */

/**
 * @typedef {Object} BalanceInfo
 * @property {boolean} success - Whether balance check succeeded
 * @property {number} balance - Current balance
 * @property {string} currency - Currency code
 * @property {Object} [raw] - Raw provider response
 * @property {string} [errorMessage] - Error message if failed
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether credentials are valid
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

class SmsAdapter {
  /**
   * Get provider metadata
   * @returns {SmsProviderMetadata}
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
   * Send an SMS message
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {SmsMessage} message - SMS message to send
   * @returns {Promise<SmsSendResult>}
   */
  async sendSms(operatorConfig, message) {
    throw new Error('sendSms must be implemented by subclass');
  }

  /**
   * Process delivery report callback (if supported)
   * @param {Object} operatorConfig - Operator's provider configuration
   * @param {Object} headers - HTTP headers from callback
   * @param {Object} body - Callback request body
   * @returns {Promise<DeliveryReport>}
   */
  async processDeliveryReport(operatorConfig, headers, body) {
    throw new Error('processDeliveryReport must be implemented by subclass');
  }

  /**
   * Check account balance (if supported)
   * @param {Object} operatorConfig - Operator's provider configuration
   * @returns {Promise<BalanceInfo>}
   */
  async checkBalance(operatorConfig) {
    throw new Error('Balance check not supported by this provider');
  }

  /**
   * Normalize phone number to provider's required format
   * @param {string} phone - Phone number in any format
   * @param {string} countryCode - Default country code (e.g., "254")
   * @returns {string} - Normalized phone number
   */
  normalizePhoneNumber(phone, countryCode = '254') {
    // Remove all non-numeric characters
    let normalized = phone.replace(/\D/g, '');
    
    // Remove leading zero if present
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    
    // Add country code if not present
    if (!normalized.startsWith(countryCode)) {
      normalized = countryCode + normalized;
    }
    
    return normalized;
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number to validate
   * @returns {boolean}
   */
  validatePhoneNumber(phone) {
    // Basic E.164 validation (simplified)
    return /^\+[1-9]\d{1,14}$/.test(phone) || /^[1-9]\d{6,14}$/.test(phone);
  }

  /**
   * Truncate message to fit within SMS segment limits
   * @param {string} message - Message to truncate
   * @param {number} [maxLength] - Maximum length (default 160 for GSM-7)
   * @returns {string} - Truncated message
   */
  truncateMessage(message, maxLength = 160) {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Check if provider supports a specific capability
   * @param {string} capability - Capability name from SmsCapabilityFlags
   * @returns {boolean}
   */
  supportsCapability(capability) {
    const metadata = this.getMetadata();
    return Boolean(metadata.capabilities[capability]);
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

  /**
   * Estimate number of SMS segments for a message
   * @param {string} message - Message content
   * @returns {number} - Estimated segment count
   */
  estimateSegments(message) {
    // Simple GSM-7 estimation (153 chars per multi-part segment)
    const gsm7Length = message.length;
    if (gsm7Length <= 160) return 1;
    return Math.ceil(gsm7Length / 153);
  }
}

module.exports = SmsAdapter;
