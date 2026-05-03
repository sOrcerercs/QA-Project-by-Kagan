import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/app/lib/auth";
import prisma from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (user) {
    prisma.activityLog.create({ data: { userId: user.id, action: "LOGOUT" } }).catch(() => {});
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("estenove_token", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
