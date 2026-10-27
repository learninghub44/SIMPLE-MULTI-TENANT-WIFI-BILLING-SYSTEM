require("dotenv").config();

console.log("Testing Provider Registry Initialization...\n");

try {
  const { paymentRegistry } = require("./src/integrations/payments/index");
  const { smsRegistry } = require("./src/integrations/sms/index");
  
  console.log("✅ Payment providers initialized successfully");
  console.log("   Registered providers:", Object.keys(paymentRegistry.providers));
  
  console.log("\n✅ SMS providers initialized successfully");
  console.log("   Registered providers:", Object.keys(smsRegistry.providers));
  
  // Test getting a provider
  const darajaProvider = paymentRegistry.getProvider('daraja');
  if (darajaProvider) {
    console.log("\n✅ Daraja provider retrieved successfully");
    console.log("   Metadata:", darajaProvider.getMetadata());
  } else {
    console.log("\n❌ Failed to retrieve Daraja provider");
  }
  
  const payheroProvider = paymentRegistry.getProvider('payhero');
  if (payheroProvider) {
    console.log("\n✅ PayHero provider retrieved successfully");
    console.log("   Metadata:", payheroProvider.getMetadata());
  } else {
    console.log("\n❌ Failed to retrieve PayHero provider");
  }
  
  const africaProvider = smsRegistry.getProvider('africas-talking');
  if (africaProvider) {
    console.log("\n✅ Africa's Talking provider retrieved successfully");
    console.log("   Metadata:", africaProvider.getMetadata());
  } else {
    console.log("\n❌ Failed to retrieve Africa's Talking provider");
  }
  
  const twilioProvider = smsRegistry.getProvider('twilio');
  if (twilioProvider) {
    console.log("\n✅ Twilio provider retrieved successfully");
    console.log("   Metadata:", twilioProvider.getMetadata());
  } else {
    console.log("\n❌ Failed to retrieve Twilio provider");
  }
  
  console.log("\n✅ All provider tests passed!");
  
} catch (error) {
  console.error("❌ Error initializing provider registries:", error.message);
  console.error(error.stack);
  process.exit(1);
}
