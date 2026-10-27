/**
 * SMS Provider Registry
 * 
 * Central registry for managing SMS provider adapters.
 * Allows dynamic registration, discovery, and selection of SMS providers.
 */

const logger = require('../../../../src/logger');

class SmsProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
  }

  /**
   * Register an SMS provider
   * @param {SmsAdapter} adapter - SMS adapter instance
   * @param {Object} options - Registration options
   * @param {boolean} [options.enabled=true] - Whether provider is enabled by default
   * @param {boolean} [options.isDefault=false] - Whether provider is default
   */
  register(adapter, options = {}) {
    const metadata = adapter.getMetadata();
    const providerId = metadata.providerId;

    if (this.providers.has(providerId)) {
      logger.warn(`SMS provider ${providerId} is already registered. Overwriting.`);
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

    logger.info(`Registered SMS provider: ${providerId} (${metadata.displayName})`);
  }

  /**
   * Unregister an SMS provider
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

    logger.info(`Unregistered SMS provider: ${providerId}`);
  }

  /**
   * Get a registered provider adapter
   * @param {string} providerId - Provider identifier
   * @returns {SmsAdapter}
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
   * @returns {SmsProviderMetadata}
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
   * @returns {Array<{providerId: string, metadata: SmsProviderMetadata, adapter: SmsAdapter}>}
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
   * Get providers that support a specific country
   * @param {string} countryCode - ISO country code
   * @param {Object} options - Additional filter options
   * @returns {Array<{providerId: string, metadata: SmsProviderMetadata}>}
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
    logger.info(`Enabled SMS provider: ${providerId}`);
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
    logger.info(`Disabled SMS provider: ${providerId}`);
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
    logger.info(`Set default SMS provider: ${providerId}`);
  }

  /**
   * Get the default provider
   * @returns {SmsAdapter}
   */
  getDefaultProvider() {
    if (!this.defaultProvider) {
      throw new Error('No default SMS provider is configured');
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
   * @param {string[]} [criteria.preferredProviders] - Preferred provider IDs in order
   * @returns {SmsAdapter}
   */
  selectProvider(criteria = {}) {
    const { providerId, country, preferredProviders = [] } = criteria;

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
          return adapter;
        }
      }
    }

    // Filter by country
    const candidates = this.getAllProviders({ enabledOnly: true, country });

    if (candidates.length === 0) {
      throw new Error('No SMS provider available for the given criteria');
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
const smsRegistry = new SmsProviderRegistry();

module.exports = smsRegistry;
