import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";

export async function GET() {
  try {
    await dbConnect();
    const state = mongoose.connection.readyState;
    if (state === 1) {
      return NextResponse.json({ db: "ok" });
    } else {
      return NextResponse.json({ db: "error", state }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json(
      { db: "error", error: String(error) },
      { status: 500 },
    );
  }
}
