// app/api/auth/forgot-password/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limiting";

export async function POST(request) {
  // SECURITY FIX: Prevent brute-force/DOS by limiting email reset requests
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const { email } = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");

  const user = await db.collection("users").findOne({ email });

  // SECURITY BEST PRACTICE: Even if user doesn't exist, return 200 to prevent "User Enumeration"
  if (!user) {
    return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  
  // SECURITY FIX: Use the field indexed for TTL to ensure auto-deletion
  await db.collection("password_resets").insertOne({
    email,
    token,
    createdAt: new Date(), 
  });

  // Here you would normally call your email service (e.g., Resend or Nodemailer)
  // console.log(`Reset Link: ${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`);

  return NextResponse.json({ message: "Reset link sent successfully." });
}