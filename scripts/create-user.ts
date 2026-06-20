import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Mevcut kullanicilar
  const existing = await prisma.user.findMany({ select: { email: true, name: true, role: true, isActive: true } });
  console.log(`\n=== Mevcut kullanicilar (${existing.length}) ===`);
  for (const u of existing) console.log(`- ${u.email} | ${u.name} | ${u.role} | active=${u.isActive}`);

  const email = process.env.NEW_USER_EMAIL!;
  const name = process.env.NEW_USER_NAME!;
  const role = (process.env.NEW_USER_ROLE ?? "ADMIN") as any;
  const password = process.env.NEW_USER_PASSWORD!;

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash, isActive: true, mustChangePassword: true },
    create: { name, email, passwordHash, role, mustChangePassword: true },
  });

  console.log(`\n✅ Kullanici hazir: ${user.email} (${user.role})`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
