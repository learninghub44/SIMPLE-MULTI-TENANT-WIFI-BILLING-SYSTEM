/**
 * Validation Utilities
 * 
 * Common validation functions for payment and SMS operations.
 */

const logger = require('../../../../src/logger');

/**
 * Validate Kenyan phone number
 * @param {string} phone - Phone number
 * @returns {Object} - { valid: boolean, normalized: string, error?: string }
 */
function validateKenyanPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Check length (Kenyan numbers are 12 digits with country code, 10 without)
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    // Convert 07... to 2547...
    const normalized = '254' + cleaned.substring(1);
    if (/^254(7|1)[0-9]{8}$/.test(normalized)) {
      return { valid: true, normalized };
    }
  }

  if (cleaned.length === 12 && cleaned.startsWith('254')) {
    if (/^254(7|1)[0-9]{8}$/.test(cleaned)) {
      return { valid: true, normalized: cleaned };
    }
  }

  if (cleaned.length === 12 && cleaned.startsWith('+254')) {
    const withoutPlus = cleaned.substring(1);
    if (/^254(7|1)[0-9]{8}$/.test(withoutPlus)) {
      return { valid: true, normalized: withoutPlus };
    }
  }

  return { valid: false, error: 'Invalid Kenyan phone number format' };
}

/**
 * Validate phone number for a specific country
 * @param {string} phone - Phone number
 * @param {string} countryCode - ISO country code (e.g., "KE", "UG", "TZ")
 * @returns {Object} - { valid: boolean, normalized: string, error?: string }
 */
function validatePhone(phone, countryCode = 'KE') {
  const countryPatterns = {
    KE: /^254(7|1)[0-9]{8}$/,
    UG: /^256(7)[0-9]{8}$/,
    TZ: /^255(6|7)[0-9]{8}$/,
  };

  const countryCodes = {
    KE: '254',
    UG: '256',
    TZ: '255',
  };

  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }

  const cleaned = phone.replace(/\D/g, '');
  const code = countryCodes[countryCode.toUpperCase()];
  const pattern = countryPatterns[countryCode.toUpperCase()];

  if (!code || !pattern) {
    return { valid: false, error: `Unsupported country code: ${countryCode}` };
  }

  // Normalize to E.164 format
  let normalized = cleaned;
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    normalized = code + cleaned.substring(1);
  } else if (cleaned.length === 13 && cleaned.startsWith('+')) {
    normalized = cleaned.substring(1);
  }

  if (pattern.test(normalized)) {
    return { valid: true, normalized };
  }

  return { valid: false, error: `Invalid ${countryCode} phone number format` };
}

/**
 * Validate MAC address
 * @param {string} mac - MAC address
 * @returns {Object} - { valid: boolean, normalized: string, error?: string }
 */
function validateMacAddress(mac) {
  if (!mac || typeof mac !== 'string') {
    return { valid: false, error: 'MAC address is required' };
  }

  // Remove all non-hex characters except colons and hyphens
  const cleaned = mac.replace(/[^a-fA-F0-9:-]/g, '');

  // Check various formats
  const patterns = [
    /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/, // 00:11:22:33:44:55
    /^([0-9a-fA-F]{2}-){5}[0-9a-fA-F]{2}$/, // 00-11-22-33-44-55
    /^[0-9a-fA-F]{12}$/, // 001122334455
  ];

  if (!patterns.some(p => p.test(cleaned))) {
    return { valid: false, error: 'Invalid MAC address format' };
  }

  // Normalize to colon-separated uppercase format
  const normalized = cleaned
    .replace(/-/g, ':')
    .toUpperCase()
    .replace(/([0-9a-fA-F]{2})(?!:)/g, '$1:')
    .replace(/:$/, '');

  return { valid: true, normalized };
}

/**
 * Validate amount
 * @param {number} amount - Amount to validate
 * @param {Object} options - Validation options
 * @param {number} [options.min=1] - Minimum amount
 * @param {number} [options.max=1000000] - Maximum amount
 * @param {number[]} [options.allowedValues] - Specific allowed values
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateAmount(amount, options = {}) {
  const { min = 1, max = 1000000, allowedValues } = options;

  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Amount must be a number' };
  }

  if (amount < min) {
    return { valid: false, error: `Amount must be at least ${min}` };
  }

  if (amount > max) {
    return { valid: false, error: `Amount must not exceed ${max}` };
  }

  if (allowedValues && !allowedValues.includes(amount)) {
    return { valid: false, error: `Amount must be one of: ${allowedValues.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Validate currency code
 * @param {string} currency - Currency code
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateCurrency(currency) {
  if (!currency || typeof currency !== 'string') {
    return { valid: false, error: 'Currency code is required' };
  }

  const validCurrencies = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS'];
  const normalized = currency.toUpperCase();

  if (!validCurrencies.includes(normalized)) {
    return { valid: false, error: `Unsupported currency: ${currency}` };
  }

  return { valid: true, normalized };
}

/**
 * Validate email address
 * @param {string} email - Email address
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validate transaction ID
 * @param {string} transactionId - Transaction ID
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateTransactionId(transactionId) {
  if (!transactionId || typeof transactionId !== 'string') {
    return { valid: false, error: 'Transaction ID is required' };
  }

  if (transactionId.length < 8 || transactionId.length > 100) {
    return { valid: false, error: 'Transaction ID must be between 8 and 100 characters' };
  }

  return { valid: true };
}

/**
 * Validate provider credentials
 * @param {Object} credentials - Credentials object
 * @param {Object} schema - Credential schema
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
function validateCredentials(credentials, schema) {
  const errors = [];
  const warnings = [];

  if (!credentials || typeof credentials !== 'object') {
    return { valid: false, errors: ['Credentials must be an object'], warnings: [] };
  }

  for (const field of schema) {
    const { key, required, type, sensitive } = field;
    const value = credentials[key];

    // Check required fields
    if (required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.displayName} is required`);
      continue;
    }

    // Skip type validation if value is empty and not required
    if (!required && !value) {
      continue;
    }

    // Type validation
    if (type === 'string' && typeof value !== 'string') {
      errors.push(`${field.displayName} must be a string`);
    } else if (type === 'number' && typeof value !== 'number') {
      errors.push(`${field.displayName} must be a number`);
    } else if (type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${field.displayName} must be a boolean`);
    }

    // Check for placeholder values
    if (sensitive && typeof value === 'string') {
      const placeholders = ['your_', 'change_', 'replace_', 'enter_', 'example'];
      if (placeholders.some(p => value.toLowerCase().startsWith(p))) {
        warnings.push(`${field.displayName} appears to be a placeholder value`);
      }
    }
  }

  // Check for extra fields
  const schemaKeys = schema.map(f => f.key);
  const extraKeys = Object.keys(credentials).filter(k => !schemaKeys.includes(k));
  if (extraKeys.length > 0) {
    warnings.push(`Unknown credential fields: ${extraKeys.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize error message for logging (remove sensitive data)
 * @param {string} message - Error message
 * @param {string[]} sensitiveKeys - Keys to redact
 * @returns {string}
 */
function sanitizeErrorMessage(message, sensitiveKeys = ['password', 'secret', 'key', 'token']) {
  let sanitized = message;
  for (const key of sensitiveKeys) {
    const regex = new RegExp(`${key}["\\s:=]+[^\\s"']+`, 'gi');
    sanitized = sanitized.replace(regex, `${key}=***REDACTED***`);
  }
  return sanitized;
}

/**
 * Validate callback payload
 * @param {Object} payload - Callback payload
 * @param {Object} schema - Expected schema
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateCallbackPayload(payload, schema) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be an object'] };
  }

  for (const [key, required] of Object.entries(schema)) {
    if (required && (payload[key] === undefined || payload[key] === null)) {
      errors.push(`Missing required field: ${key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateKenyanPhone,
  validatePhone,
  validateMacAddress,
  validateAmount,
  validateCurrency,
  validateEmail,
  validateTransactionId,
  validateCredentials,
  sanitizeErrorMessage,
  validateCallbackPayload,
};
