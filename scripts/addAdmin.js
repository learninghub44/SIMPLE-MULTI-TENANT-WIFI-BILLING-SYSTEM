const bcrypt = require("bcryptjs");
const prisma = require("../config/prismaClient");

async function createAdmin() {
    const email = String(process.env.ADMIN_EMAIL || "").trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
        process.exitCode = 1;
        return;
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await prisma.admin.create({
            data: {
                email,
                password: hashedPassword
            }
        });
        console.log("Admin added successfully.");
    } catch (_error) {
        console.error("Admin creation failed.");
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
