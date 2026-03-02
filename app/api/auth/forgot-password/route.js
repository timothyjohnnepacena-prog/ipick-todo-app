import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { z } from "zod";
import { ratelimit } from "@/lib/ratelimit";
import { headers } from "next/headers";

const forgotSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
    const { success } = await ratelimit.limit(`forgot_${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const rawData = await request.json();
    const validation = forgotSchema.safeParse(rawData);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    const { email } = validation.data;
    const client = await clientPromise;
    const db = client.db("kanban_db");

    const user = await db.collection("users").findOne({ email });

    // Always return success to prevent user enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Use cryptographically secure random code
    const resetCode = crypto.randomInt(100000, 999999).toString();

    // Hash the reset code before storing
    const hashedCode = crypto
      .createHash("sha256")
      .update(resetCode)
      .digest("hex");

    await db.collection("password_resets").updateOne(
      { email },
      { $set: { email, code: hashedCode, createdAt: new Date() } },
      { upsert: true }
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"iPick Center Board" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your iPick Center Verification Code",
      html: `<h1>Your code is ${resetCode}</h1>`,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}