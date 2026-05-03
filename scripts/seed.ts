import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash("Estenove2026!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@estenove.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@estenove.com",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  console.log("✅ Admin oluşturuldu:", admin.email);
  console.log("📧 Email: admin@estenove.com");
  console.log("🔑 Şifre: Estenove2026!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());