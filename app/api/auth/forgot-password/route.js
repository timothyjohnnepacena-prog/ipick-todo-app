import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { email } = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return NextResponse.json({ error: "No account found with this email" }, { status: 404 });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    await db.collection("password_resets").updateOne(
      { email },
      { $set: { email, code: resetCode, createdAt: new Date() } },
      { upsert: true }
    );

    const emailRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/email/send-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: resetCode }),
    });

    if (!emailRes.ok) {
      throw new Error("Failed to send email");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}