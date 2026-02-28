// app/api/auth/verify-code/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limiting";

export async function POST(request) {
  // SECURITY FIX: Apply rate limiting to prevent code brute-forcing
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." }, 
      { status: 429 }
    );
  }

  const { email, code } = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");

  const tempUser = await db.collection("temp_registrations").findOne({ email });

  if (!tempUser || tempUser.verificationCode !== code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // SECURITY FIX: Explicitly set fields to avoid accidental data overwrites
  await db.collection("users").updateOne(
    { email },
    { 
      $set: { 
        name: tempUser.name, 
        nickname: tempUser.nickname, 
        username: tempUser.username, 
        password: tempUser.password,
        registered: true 
      } 
    },
    { upsert: true }
  );

  await db.collection("temp_registrations").deleteOne({ email });
  return NextResponse.json({ success: true });
}