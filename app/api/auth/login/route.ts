export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditAdminData } from "@/lib/roles";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pinRaw = (body?.pin ?? "").toString();
    const pin = pinRaw.trim();

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    if (pin.length > 10) {
      return NextResponse.json({ error: "PIN must be at most 10 digits" }, { status: 400 });
    }

    // Avoid selecting createdAt/updatedAt: some User rows have MySQL
    // zero-dates (0000-00-00) which Prisma cannot deserialize (P2020).
    const user = await prisma.user.findUnique({
      where: { pin },
      select: { id: true, name: true, role: true, pin: true },
    });

    // If DB is reachable but user isn't found, return 401 (no 500)
    if (!user) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    if ((user.role || "").trim() === "field_operator") {
      return NextResponse.json(
        { error: "Use Field Operator login (Operator ID + PIN)" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: (user.role || "").trim(),
      pin: user.pin,
      canEditAdmin: canEditAdminData({ ...user, role: (user.role || "").trim() }),
    });
  } catch (error) {
    console.error("Login error:", error);

    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV !== "production" ? message : undefined,
      },
      { status: 500 },
    );
  }
}

