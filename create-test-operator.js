require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("./config/prismaClient");

async function createTestOperator() {
  try {
    const passwordHash = await bcrypt.hash("TestPassword123", 12);
    
    const operator = await prisma.operator.upsert({
      where: { slug: "test-wifi" },
      update: {},
      create: {
        businessName: "Test WiFi Hotspot",
        slug: "test-wifi",
        email: "test@wifi.com",
        passwordHash,
        status: "active",
      },
    });
    
    console.log("✅ Test operator created/updated:", {
      businessName: operator.businessName,
      slug: operator.slug,
      email: operator.email,
    });
    console.log("\nAccess the app at: http://localhost:5000");
    console.log("The app will now show the WiFi payment portal instead of the platform landing page.");
  } catch (error) {
    console.error("❌ Error creating test operator:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestOperator();
