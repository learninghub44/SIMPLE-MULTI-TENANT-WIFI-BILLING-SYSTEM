const bcrypt = require("bcryptjs");
const prisma = require("./prismaClient"); // adjust path if needed

async function createAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "").trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
    process.exitCode = 1;
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      console.error("Admin with this email already exists.");
      process.exitCode = 1;
      return;
    }

    await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    console.log("Admin created.");
  } catch (_error) {
    console.error("Admin creation failed.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
