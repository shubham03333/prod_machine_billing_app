import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnlyAdmin, LEGACY_READONLY_PIN } from "@/lib/roles";

const READONLY_ERROR = {
  error: "Access denied. Read-only admins cannot change data.",
};

export async function isReadOnlyRequest(request: NextRequest): Promise<boolean> {
  const userPin = request.headers.get("x-user-pin")?.trim();
  if (!userPin) return false;
  if (userPin === LEGACY_READONLY_PIN) return true;

  const user = await prisma.user.findUnique({
    where: { pin: userPin },
    select: { role: true, pin: true },
  });

  return isReadOnlyAdmin(user);
}

/**
 * Blocks write operations for read-only admin users.
 * Returns a 403 response if the request is read-only, otherwise null.
 */
export async function checkReadOnlyGuard(
  request: NextRequest,
): Promise<NextResponse | null> {
  try {
    if (await isReadOnlyRequest(request)) {
      return NextResponse.json(READONLY_ERROR, { status: 403 });
    }
    return null;
  } catch (error) {
    console.error("Auth guard error:", error);
    return null;
  }
}
