import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { z } from "zod";
import { ratelimit } from "@/lib/ratelimit";
import { headers } from "next/headers";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  nickname: z.string().optional(),
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Invalid email address format"),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).optional(),
  resendOnly: z.boolean().optional()
});

export async function POST(request) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
    const { success } = await ratelimit.limit(`register_${ip}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again in a minute." }, { status: 429 });
    }

    const rawData = await request.json();
    
    const validation = registerSchema.safeParse(rawData);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }
    
    const data = validation.data;
    const client = await clientPromise;
    const db = client.db("kanban_db");

    if (!data.resendOnly) {
      const existingUser = await db.collection("users").findOne({
        $or: [{ email: data.email }, { username: data.username }]
      });

      if (existingUser) {
        if (existingUser.email === data.email) return NextResponse.json({ error: "Email address is already registered." }, { status: 400 });
        if (existingUser.username === data.username) return NextResponse.json({ error: "Username is already taken." }, { status: 400 });
      }
    }

    const serverGeneratedCode = crypto.randomInt(100000, 999999).toString();

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
    }

    if (data.resendOnly) {
      await db.collection("temp_registrations").updateOne(
        { email: data.email },
        { $set: { verificationCode: serverGeneratedCode } }
      );
    } else {
      await db.collection("temp_registrations").updateOne(
        { email: data.email },
        { $set: { ...data, verificationCode: serverGeneratedCode, createdAt: new Date() } },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}