/**
 * Payment Provider Initialization
 * 
 * Registers all available payment providers with the registry.
 */

const paymentRegistry = require('./registry/PaymentProviderRegistry');
const DarajaAdapter = require('./providers/daraja/DarajaAdapter');
const PayHeroAdapter = require('./providers/payhero/PayHeroAdapter');

/**
 * Initialize and register all payment providers
 */
function initializePaymentProviders() {
  // Register Daraja
  const darajaAdapter = new DarajaAdapter();
  paymentRegistry.register(darajaAdapter, {
    enabled: true,
    isDefault: true, // Daraja is default for now
  });

  // Register PayHero
  const payheroAdapter = new PayHeroAdapter();
  paymentRegistry.register(payheroAdapter, {
    enabled: true,
    isDefault: false,
  });

  // Future providers can be registered here:
  // const pesapalAdapter = new PesapalAdapter();
  // paymentRegistry.register(pesapalAdapter, { enabled: true });

  // const flutterwaveAdapter = new FlutterwaveAdapter();
  // paymentRegistry.register(flutterwaveAdapter, { enabled: true });

  return paymentRegistry;
}

// Initialize providers on import
initializePaymentProviders();

module.exports = {
  initializePaymentProviders,
  paymentRegistry,
};
