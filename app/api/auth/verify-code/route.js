// app/api/auth/verify-code/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limiting";

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const { email, code } = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");

  // 1. Find the temporary registration
  const tempUser = await db.collection("temp_registrations").findOne({ email, verificationCode: code });
  if (!tempUser) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  // 2. Final Security Check: Ensure username wasn't taken while waiting for the code
  const usernameTaken = await db.collection("users").findOne({ username: tempUser.username });
  if (usernameTaken) {
    return NextResponse.json({ error: "Username was recently taken. Please register again." }, { status: 400 });
  }

  // 3. Move from temp to main users collection
  await db.collection("users").insertOne({
    name: tempUser.name,
    nickname: tempUser.nickname,
    username: tempUser.username,
    email: tempUser.email,
    password: tempUser.password, // This is already hashed from the temp route
    registered: true,
    createdAt: new Date()
  });

  // 4. Clean up temp data
  await db.collection("temp_registrations").deleteOne({ email });

  return NextResponse.json({ success: true });
}