/**
 * Webhook Security Utilities
 * 
 * Provides functions for verifying webhook signatures and preventing replay attacks.
 */

const crypto = require('node:crypto');
const logger = require('../../../../src/logger');

/**
 * Verify HMAC-SHA256 signature (used by many providers)
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from header
 * @param {string} secret - Provider secret key
 * @param {string} [signaturePrefix] - Optional prefix to strip (e.g., "sha256=")
 * @returns {boolean}
 */
function verifyHmacSignature(payload, signature, secret, signaturePrefix = '') {
  try {
    // Remove prefix if present
    const cleanSignature = signaturePrefix 
      ? signature.replace(new RegExp(`^${signaturePrefix}`), '')
      : signature;

    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const expectedSignature = hmac.digest('hex');

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (error) {
    logger.error('HMAC signature verification failed', { error: error.message });
    return false;
  }
}

/**
 * Verify base64-encoded signature (used by some providers)
 * @param {string} payload - Raw request body
 * @param {string} signature - Base64-encoded signature
 * @param {string} secret - Provider secret key
 * @param {string} [algorithm='sha256'] - Hash algorithm
 * @returns {boolean}
 */
function verifyBase64Signature(payload, signature, secret, algorithm = 'sha256') {
  try {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload, 'utf8');
    const expectedSignature = hmac.digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  } catch (error) {
    logger.error('Base64 signature verification failed', { error: error.message });
    return false;
  }
}

/**
 * Check for replay attacks using timestamp
 * @param {number} timestamp - Unix timestamp from callback
 * @param {number} [toleranceSeconds=300] - Maximum allowed age in seconds (default 5 minutes)
 * @returns {boolean}
 */
function isTimestampValid(timestamp, toleranceSeconds = 300) {
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;
  return age >= 0 && age <= toleranceSeconds;
}

/**
 * Generate a signature for testing purposes
 * @param {string} payload - Request body
 * @param {string} secret - Secret key
 * @param {string} [format='hex'] - Output format: 'hex' or 'base64'
 * @returns {string}
 */
function generateSignature(payload, secret, format = 'hex') {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return format === 'base64' ? hmac.digest('base64') : hmac.digest('hex');
}

/**
 * Verify Daraja M-Pesa callback signature
 * Daraja uses a specific signature format
 * @param {string} password - Base64-encoded password from callback
 * @param {string} shortcode - M-Pesa shortcode
 * @param {string} passkey - M-Pesa passkey
 * @param {string} timestamp - Timestamp from callback
 * @returns {boolean}
 */
function verifyDarajaSignature(password, shortcode, passkey, timestamp) {
  try {
    // Generate expected password
    const expectedPassword = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    return password === expectedPassword;
  } catch (error) {
    logger.error('Daraja signature verification failed', { error: error.message });
    return false;
  }
}

/**
 * Extract signature from various header formats
 * @param {Object} headers - HTTP headers
 * @param {string[]} possibleHeaders - Possible header names to check
 * @returns {string|null}
 */
function extractSignature(headers, possibleHeaders) {
  for (const headerName of possibleHeaders) {
    const signature = headers[headerName] || headers[headerName.toLowerCase()];
    if (signature) {
      return signature;
    }
  }
  return null;
}

/**
 * Validate webhook request
 * @param {Object} options - Validation options
 * @param {string} options.payload - Raw request body
 * @param {Object} options.headers - HTTP headers
 * @param {string} options.secret - Provider secret
 * @param {string} [options.signatureHeader] - Header containing signature
 * @param {string} [options.signaturePrefix] - Signature prefix to strip
 * @param {number} [options.timestampHeader] - Header containing timestamp
 * @param {number} [options.toleranceSeconds] - Timestamp tolerance
 * @returns {Object} - { valid: boolean, reason?: string }
 */
function validateWebhook(options) {
  const {
    payload,
    headers,
    secret,
    signatureHeader = 'x-signature',
    signaturePrefix = '',
    timestampHeader,
    toleranceSeconds = 300,
  } = options;

  // Check timestamp if provided
  if (timestampHeader) {
    const timestamp = headers[timestampHeader] || headers[timestampHeader.toLowerCase()];
    if (timestamp) {
      const timestampNum = parseInt(timestamp, 10);
      if (!isTimestampValid(timestampNum, toleranceSeconds)) {
        return {
          valid: false,
          reason: 'Timestamp is too old or in the future',
        };
      }
    }
  }

  // Check signature
  const signature = extractSignature(headers, [signatureHeader, signatureHeader.toLowerCase()]);
  if (!signature) {
    return {
      valid: false,
      reason: 'Signature header is missing',
    };
  }

  const isValid = verifyHmacSignature(payload, signature, secret, signaturePrefix);
  if (!isValid) {
    return {
      valid: false,
      reason: 'Signature verification failed',
    };
  }

  return { valid: true };
}

/**
 * Replay attack prevention using idempotency keys
 * @param {Map} processedCallbacks - Map of processed callback IDs
 * @param {string} callbackId - Unique identifier for this callback
 * @param {number} [ttlSeconds=86400] - Time-to-live for callback records (default 24 hours)
 * @returns {boolean} - true if callback is new, false if it's a replay
 */
function isCallbackNew(processedCallbacks, callbackId, ttlSeconds = 86400) {
  const now = Date.now();
  const record = processedCallbacks.get(callbackId);

  if (!record) {
    // First time seeing this callback
    processedCallbacks.set(callbackId, { timestamp: now });
    return true;
  }

  // Check if record has expired
  const age = (now - record.timestamp) / 1000;
  if (age > ttlSeconds) {
    // Record expired, treat as new
    processedCallbacks.set(callbackId, { timestamp: now });
    return true;
  }

  // Record exists and hasn't expired - this is a replay
  logger.warn('Detected replayed callback', { callbackId, age });
  return false;
}

/**
 * Clean up expired callback records
 * @param {Map} processedCallbacks - Map of processed callback IDs
 * @param {number} [ttlSeconds=86400] - Time-to-live for callback records
 * @returns {number} - Number of records cleaned up
 */
function cleanupExpiredCallbacks(processedCallbacks, ttlSeconds = 86400) {
  const now = Date.now();
  let cleaned = 0;

  for (const [callbackId, record] of processedCallbacks.entries()) {
    const age = (now - record.timestamp) / 1000;
    if (age > ttlSeconds) {
      processedCallbacks.delete(callbackId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} expired callback records`);
  }

  return cleaned;
}

module.exports = {
  verifyHmacSignature,
  verifyBase64Signature,
  isTimestampValid,
  generateSignature,
  verifyDarajaSignature,
  extractSignature,
  validateWebhook,
  isCallbackNew,
  cleanupExpiredCallbacks,
};
