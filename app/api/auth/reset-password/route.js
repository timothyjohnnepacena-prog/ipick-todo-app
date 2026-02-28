// app/api/auth/reset-password/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(request) {
  const { token, newPassword } = await request.json();
  
  if (!token || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Invalid input. Password must be 8+ chars." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db("kanban_db");

  // 1. Find the token
  const resetRequest = await db.collection("password_resets").findOne({ token });

  if (!resetRequest) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 400 });
  }

  // 2. Hash new password (12 rounds for high security)
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // 3. Update the user
  await db.collection("users").updateOne(
    { email: resetRequest.email },
    { $set: { password: hashedPassword } }
  );

  // 4. SECURITY FIX: Delete token immediately after use so it can't be reused
  await db.collection("password_resets").deleteOne({ token });

  return NextResponse.json({ success: true, message: "Password updated successfully." });
}