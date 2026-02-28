// app/api/profile/temp/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(request) {
  try {
    const data = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    // Check for existing users to prevent account takeover
    if (!data.resendOnly) {
      const existingUser = await db.collection("users").findOne({
        $or: [{ email: data.email }, { username: data.username }]
      });

      if (existingUser) {
        return NextResponse.json({ error: "User already exists" }, { status: 400 });
      }
    }

    // Always hash passwords before storing in temp collection
    if (data.password) {
      const salt = await bcrypt.genSalt(12); // Use 12 rounds for better security
      data.password = await bcrypt.hash(data.password, salt);
      delete data.confirmPassword;
    }

    // Logic for resending or initial temp save
    const updateData = data.resendOnly 
      ? { verificationCode: data.verificationCode } 
      : { ...data, createdAt: new Date() };

    await db.collection("temp_registrations").updateOne(
      { email: data.email },
      { $set: updateData },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}