/**
 * Payment Provider Registry
 * 
 * Central registry for managing payment provider adapters.
 * Allows dynamic registration, discovery, and selection of payment providers.
 */

const logger = require('../../../../src/logger');

class PaymentProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
  }

  /**
   * Register a payment provider
   * @param {PaymentAdapter} adapter - Payment adapter instance
   * @param {Object} options - Registration options
   * @param {boolean} [options.enabled=true] - Whether provider is enabled by default
   * @param {boolean} [options.isDefault=false] - Whether provider is default
   */
  register(adapter, options = {}) {
    const metadata = adapter.getMetadata();
    const providerId = metadata.providerId;

    if (this.providers.has(providerId)) {
      logger.warn(`Payment provider ${providerId} is already registered. Overwriting.`);
    }

    this.providers.set(providerId, {
      adapter,
      metadata,
      enabled: options.enabled !== false,
      registeredAt: new Date(),
    });

    if (options.isDefault) {
      this.defaultProvider = providerId;
    }

    logger.info(`Registered payment provider: ${providerId} (${metadata.displayName})`);
  }

  /**
   * Unregister a payment provider
   * @param {string} providerId - Provider identifier
   */
  unregister(providerId) {
    if (!this.providers.has(providerId)) {
      throw new Error(`Provider ${providerId} is not registered`);
    }

    this.providers.delete(providerId);

    if (this.defaultProvider === providerId) {
      this.defaultProvider = null;
    }

    logger.info(`Unregistered payment provider: ${providerId}`);
  }

  /**
   * Get a registered provider adapter
   * @param {string} providerId - Provider identifier
   * @returns {PaymentAdapter}
   */
  getProvider(providerId) {
    const entry = this.providers.get(providerId);
    if (!entry) {
      throw new Error(`Provider ${providerId} is not registered`);
    }
    if (!entry.enabled) {
      throw new Error(`Provider ${providerId} is disabled`);
    }
    return entry.adapter;
  }

  /**
   * Get provider metadata
   * @param {string} providerId - Provider identifier
   * @returns {PaymentProviderMetadata}
   */
  getMetadata(providerId) {
    const entry = this.providers.get(providerId);
    if (!entry) {
      throw new Error(`Provider ${providerId} is not registered`);
    }
    return entry.metadata;
  }

  /**
   * Get all registered providers
   * @param {Object} options - Filter options
   * @param {boolean} [options.enabledOnly=true] - Only return enabled providers
   * @param {string} [options.country] - Filter by supported country
   * @param {string} [options.capability] - Filter by capability
   * @returns {Array<{providerId: string, metadata: PaymentProviderMetadata, adapter: PaymentAdapter}>}
   */
  getAllProviders(options = {}) {
    const { enabledOnly = true, country, capability } = options;

    let providers = Array.from(this.providers.entries()).map(([providerId, entry]) => ({
      providerId,
      metadata: entry.metadata,
      adapter: entry.adapter,
      enabled: entry.enabled,
    }));

    if (enabledOnly) {
      providers = providers.filter(p => p.enabled);
    }

    if (country) {
      providers = providers.filter(p => p.adapter.supportsCountry(country));
    }

    if (capability) {
      providers = providers.filter(p => p.adapter.supportsCapability(capability));
    }

    return providers;
  }

  /**
   * Get providers that support a specific payment method
   * @param {string} methodId - Payment method ID
   * @param {Object} options - Additional filter options
   * @returns {Array<{providerId: string, metadata: PaymentProviderMetadata}>}
   */
  getProvidersByMethod(methodId, options = {}) {
    const providers = this.getAllProviders(options);
    return providers.filter(p => p.adapter.supportsMethod(methodId));
  }

  /**
   * Get providers that support a specific country
   * @param {string} countryCode - ISO country code
   * @param {Object} options - Additional filter options
   * @returns {Array<{providerId: string, metadata: PaymentProviderMetadata}>}
   */
  getProvidersByCountry(countryCode, options = {}) {
    return this.getAllProviders({ ...options, country: countryCode });
  }

  /**
   * Enable a provider
   * @param {string} providerId - Provider identifier
   */
  enable(providerId) {
    const entry = this.providers.get(providerId);
    if (!entry) {
      throw new Error(`Provider ${providerId} is not registered`);
    }
    entry.enabled = true;
    logger.info(`Enabled payment provider: ${providerId}`);
  }

  /**
   * Disable a provider
   * @param {string} providerId - Provider identifier
   */
  disable(providerId) {
    const entry = this.providers.get(providerId);
    if (!entry) {
      throw new Error(`Provider ${providerId} is not registered`);
    }
    entry.enabled = false;
    logger.info(`Disabled payment provider: ${providerId}`);
  }

  /**
   * Check if a provider is registered
   * @param {string} providerId - Provider identifier
   * @returns {boolean}
   */
  isRegistered(providerId) {
    return this.providers.has(providerId);
  }

  /**
   * Check if a provider is enabled
   * @param {string} providerId - Provider identifier
   * @returns {boolean}
   */
  isEnabled(providerId) {
    const entry = this.providers.get(providerId);
    return Boolean(entry && entry.enabled);
  }

  /**
   * Set the default provider
   * @param {string} providerId - Provider identifier
   */
  setDefault(providerId) {
    if (!this.isRegistered(providerId)) {
      throw new Error(`Provider ${providerId} is not registered`);
    }
    this.defaultProvider = providerId;
    logger.info(`Set default payment provider: ${providerId}`);
  }

  /**
   * Get the default provider
   * @returns {PaymentAdapter}
   */
  getDefaultProvider() {
    if (!this.defaultProvider) {
      throw new Error('No default payment provider is configured');
    }
    return this.getProvider(this.defaultProvider);
  }

  /**
   * Get the default provider ID
   * @returns {string}
   */
  getDefaultProviderId() {
    return this.defaultProvider;
  }

  /**
   * Select a provider based on criteria
   * @param {Object} criteria - Selection criteria
   * @param {string} [criteria.providerId] - Specific provider ID
   * @param {string} [criteria.country] - Country code
   * @param {string} [criteria.method] - Payment method
   * @param {string[]} [criteria.preferredProviders] - Preferred provider IDs in order
   * @returns {PaymentAdapter}
   */
  selectProvider(criteria = {}) {
    const { providerId, country, method, preferredProviders = [] } = criteria;

    // If specific provider requested, use it
    if (providerId) {
      return this.getProvider(providerId);
    }

    // If preferred providers list, try in order
    if (preferredProviders.length > 0) {
      for (const prefId of preferredProviders) {
        if (this.isEnabled(prefId)) {
          const adapter = this.getProvider(prefId);
          if (country && !adapter.supportsCountry(country)) continue;
          if (method && !adapter.supportsMethod(method)) continue;
          return adapter;
        }
      }
    }

    // Filter by country and method
    const candidates = this.getAllProviders({ enabledOnly: true, country, capability: method ? 'initiatePayment' : undefined });

    if (candidates.length === 0) {
      throw new Error('No payment provider available for the given criteria');
    }

    // If method specified, filter further
    if (method) {
      const methodCandidates = candidates.filter(c => c.adapter.supportsMethod(method));
      if (methodCandidates.length > 0) {
        return methodCandidates[0].adapter;
      }
    }

    // Return first available
    return candidates[0].adapter;
  }

  /**
   * Get provider statistics
   * @returns {Object}
   */
  getStatistics() {
    const total = this.providers.size;
    const enabled = Array.from(this.providers.values()).filter(p => p.enabled).length;
    const disabled = total - enabled;

    return {
      total,
      enabled,
      disabled,
      default: this.defaultProvider,
      providers: Array.from(this.providers.entries()).map(([id, entry]) => ({
        id,
        displayName: entry.metadata.displayName,
        enabled: entry.enabled,
        registeredAt: entry.registeredAt,
      })),
    };
  }
}

// Create singleton instance
const paymentRegistry = new PaymentProviderRegistry();

module.exports = paymentRegistry;
