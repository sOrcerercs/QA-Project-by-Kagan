import { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId?: string | null;
};

export async function getUserFromToken(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get("estenove_token")?.value;
  if (!token) return null;
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("[auth] JWT_SECRET is not configured — all token verifications will fail");
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}
