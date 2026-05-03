import { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function getUserFromToken(req: NextRequest) {
  const token = req.cookies.get("estenove_token")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as any;
  } catch {
    return null;
  }
}
