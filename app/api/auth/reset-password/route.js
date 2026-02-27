import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(request) {
  try {
    const { email, code, newPassword } = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    const resetEntry = await db.collection("password_resets").findOne({ 
      email, 
      code 
    });

    if (!resetEntry) {
      return NextResponse.json({ error: "Invalid or expired reset code" }, { status: 400 });
    }

    const now = new Date();
    const codeAge = (now - new Date(resetEntry.createdAt)) / 1000 / 60;
    if (codeAge > 60) {
      return NextResponse.json({ error: "Reset code has expired" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateResult = await db.collection("users").updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    await db.collection("password_resets").deleteOne({ email });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}