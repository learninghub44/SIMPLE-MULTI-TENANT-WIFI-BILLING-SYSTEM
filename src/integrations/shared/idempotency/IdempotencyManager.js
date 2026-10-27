/**
 * Idempotency Manager
 * 
 * Prevents duplicate processing of payment requests and callbacks
 * using idempotency keys and request deduplication.
 */

const crypto = require('node:crypto');
const logger = require('../../../../src/logger');

/**
 * In-memory idempotency store (for production, use Redis)
 */
class IdempotencyStore {
  constructor() {
    this.store = new Map();
    this.ttl = 24 * 60 * 60 * 1000; // 24 hours default TTL
  }

  /**
   * Set a record
   * @param {string} key - Idempotency key
   * @param {Object} value - Value to store
   * @param {number} [ttl] - Time-to-live in milliseconds
   */
  set(key, value, ttl = this.ttl) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Get a record
   * @param {string} key - Idempotency key
   * @returns {Object|null}
   */
  get(key) {
    const record = this.store.get(key);
    if (!record) return null;

    // Check if expired
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return record.value;
  }

  /**
   * Check if a key exists
   * @param {string} key - Idempotency key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete a record
   * @param {string} key - Idempotency key
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Clean up expired records
   * @returns {number} - Number of records cleaned
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of this.store.entries()) {
      if (now > record.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired idempotency records`);
    }

    return cleaned;
  }

  /**
   * Get store statistics
   * @returns {Object}
   */
  getStats() {
    return {
      size: this.store.size,
      ttl: this.ttl,
    };
  }
}

// Singleton instance
const idempotencyStore = new IdempotencyStore();

/**
 * Generate a random idempotency key
 * @param {string} [prefix] - Optional prefix for the key
 * @returns {string}
 */
function generateIdempotencyKey(prefix = 'idem') {
  const random = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${random}` : random;
}

/**
 * Create a deterministic idempotency key from request parameters
 * @param {Object} params - Request parameters
 * @param {string} params.operatorId - Operator ID
 * @param {string} params.phone - Phone number
 * @param {number} params.amount - Amount
 * @param {string} [params.transactionId] - Transaction ID
 * @returns {string}
 */
function createDeterministicKey(params) {
  const { operatorId, phone, amount, transactionId } = params;
  const data = `${operatorId}:${phone}:${amount}:${transactionId || ''}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return `det_${hash}`;
}

/**
 * Check if a request with this idempotency key has been processed
 * @param {string} key - Idempotency key
 * @returns {boolean}
 */
function isRequestProcessed(key) {
  return idempotencyStore.has(key);
}

/**
 * Get the result of a previously processed request
 * @param {string} key - Idempotency key
 * @returns {Object|null}
 */
function getProcessedResult(key) {
  return idempotencyStore.get(key);
}

/**
 * Record a processed request
 * @param {string} key - Idempotency key
 * @param {Object} result - Result to store
 * @param {number} [ttl] - Time-to-live in milliseconds
 */
function recordProcessedRequest(key, result, ttl) {
  idempotencyStore.set(key, result, ttl);
}

/**
 * Execute a function with idempotency protection
 * @param {string} key - Idempotency key
 * @param {Function} fn - Function to execute
 * @param {Object} [options] - Options
 * @param {number} [options.ttl] - Time-to-live for result
 * @param {boolean} [options.returnCached=true] - Whether to return cached result
 * @returns {Promise<Object>}
 */
/*
async function withIdempotency(key, fn, options = {}) {
  const { ttl, returnCached = true } = options;

  // Check if already processed
  if (idempotencyStore.has(key)) {
    if (returnCached) {
      logger.info('Returning cached result for idempotency key', { key });
      return idempotencyStore.get(key);
    }
    throw new Error('Request with this idempotency key has already been processed');
  }

  // Execute function
  const result = await fn();

  // Store result
  idempotencyStore.set(key, result, ttl);

  return result;
}
*/

/**
 * Idempotency manager class for more complex scenarios
 */
class IdempotencyManager {
  constructor(store = idempotencyStore) {
    this.store = store;
  }

  /**
   * Execute operation with idempotency
   * @param {string} key - Idempotency key
   * @param {Function} operation - Async function to execute
   * @param {Object} options - Options
   * @returns {Promise<Object>}
   */
  async execute(key, operation, options = {}) {
    const { ttl = this.store.ttl, returnCached = true } = options;

    // Check if already processed
    if (this.store.has(key)) {
      if (returnCached) {
        logger.info('Returning cached result for idempotency key', { key });
        return {
          status: 'cached',
          data: this.store.get(key),
        };
      }
      throw new Error('Request with this idempotency key has already been processed');
    }

    // Execute operation
    try {
      const result = await operation();
      
      // Store successful result
      this.store.set(key, {
        success: true,
        data: result,
        timestamp: Date.now(),
      }, ttl);

      return {
        status: 'success',
        data: result,
      };
    } catch (error) {
      // Don't store errors by default (allow retry)
      logger.error('Operation failed with idempotency key', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Mark a key as processed with a specific result
   * @param {string} key - Idempotency key
   * @param {Object} result - Result to store
   * @param {number} [ttl] - Time-to-live
   */
  markProcessed(key, result, ttl) {
    this.store.set(key, {
      success: true,
      data: result,
      timestamp: Date.now(),
    }, ttl);
  }

  /**
   * Check if a key is processed
   * @param {string} key - Idempotency key
   * @returns {boolean}
   */
  isProcessed(key) {
    return this.store.has(key);
  }

  /**
   * Get processed result
   * @param {string} key - Idempotency key
   * @returns {Object|null}
   */
  getResult(key) {
    return this.store.get(key);
  }

  /**
   * Invalidate a key
   * @param {string} key - Idempotency key
   */
  invalidate(key) {
    this.store.delete(key);
  }

  /**
   * Clean up expired records
   * @returns {number}
   */
  cleanup() {
    return this.store.cleanup();
  }
}

module.exports = {
  IdempotencyStore,
  idempotencyStore,
  generateIdempotencyKey,
  createDeterministicKey,
  isRequestProcessed,
  getProcessedResult,
  recordProcessedRequest,
  IdempotencyManager,
};
