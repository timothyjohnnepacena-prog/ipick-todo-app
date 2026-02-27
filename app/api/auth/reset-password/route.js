import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(request) {
  try {
    const { email, code, newPassword } = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    const resetRecord = await db.collection("password_resets").findOne({ email });
    if (!resetRecord || resetRecord.code !== code) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.collection("users").updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    await db.collection("password_resets").deleteOne({ email });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}