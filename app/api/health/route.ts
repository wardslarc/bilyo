import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const state = mongoose.connection.readyState;
    if (state === 1) {
      return NextResponse.json({
        status: "healthy",
        db: "ok",
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { status: "unhealthy", db: "error", state },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        db: "error",
        error: (error as Error).message || String(error),
      },
      { status: 500 },
    );
  }
}
