/**
 * SMS Provider Initialization
 * 
 * Registers all available SMS providers with the registry.
 */

const smsRegistry = require('./registry/SmsProviderRegistry');
const AfricaTalkingAdapter = require('./providers/africas-talking/AfricaTalkingAdapter');
const TwilioAdapter = require('./providers/twilio/TwilioAdapter');

/**
 * Initialize and register all SMS providers
 */
function initializeSmsProviders() {
  // Register Africa's Talking
  const africaAdapter = new AfricaTalkingAdapter();
  smsRegistry.register(africaAdapter, {
    enabled: true,
    isDefault: true, // Africa's Talking is default for Kenya
  });

  // Register Twilio
  const twilioAdapter = new TwilioAdapter();
  smsRegistry.register(twilioAdapter, {
    enabled: true,
    isDefault: false,
  });

  // Future providers can be registered here:
  // const centipedeAdapter = new CentipedeAdapter();
  // smsRegistry.register(centipedeAdapter, { enabled: true });

  return smsRegistry;
}

// Initialize providers on import
initializeSmsProviders();

module.exports = {
  initializeSmsProviders,
  smsRegistry,
};
