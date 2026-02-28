// app/api/auth/verify-code/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { email, code } = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    const tempUser = await db.collection("temp_registrations").findOne({ email, verificationCode: code });

    if (!tempUser) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
    }

    // Use updateOne WITHOUT upsert to prevent unauthorized creation of accounts
    const result = await db.collection("users").updateOne(
      { email },
      { 
        $set: { 
          name: tempUser.name, 
          nickname: tempUser.nickname, 
          username: tempUser.username, 
          password: tempUser.password,
          registered: true,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      // If user document doesn't exist yet, insert it specifically
      await db.collection("users").insertOne({
        email,
        name: tempUser.name,
        nickname: tempUser.nickname,
        username: tempUser.username,
        password: tempUser.password,
        registered: true,
        createdAt: new Date()
      });
    }

    await db.collection("temp_registrations").deleteOne({ email });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}