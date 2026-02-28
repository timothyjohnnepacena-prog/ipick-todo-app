// app/api/email/send-code/route.js
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limiting";

export async function POST(request) {
  try {
    // 1. Enforce Rate Limiting
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." }, 
        { status: 429 }
      );
    }

    const { email, verificationCode } = await request.json();

    // 2. Configure NodeMailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // MUST be a 16-character App Password
      },
    });

    // 3. Send Email
    await transporter.sendMail({
      from: `"iPick Support" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Your iPick Verification Code",
      text: `Your verification code is: ${verificationCode}`,
      html: `<b>Your verification code is: ${verificationCode}</b>`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email Error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}