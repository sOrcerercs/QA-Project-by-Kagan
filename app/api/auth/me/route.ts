import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/app/lib/auth";
import prisma from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);

  if (!user) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mustChangePassword: true },
  });

  return NextResponse.json({
    user: {
      ...user,
      mustChangePassword: dbUser?.mustChangePassword ?? false,
    },
  });
}
