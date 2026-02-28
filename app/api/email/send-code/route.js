// app/api/email/send-code/route.js
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { email, verificationCode, name } = await request.json();

    // 1. Validation: Ensure all data is present
    if (!email || !verificationCode) {
      return NextResponse.json({ error: "Missing email or code" }, { status: 400 });
    }

    // 2. Transporter Setup: Using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail address (e.g., example@gmail.com)
        pass: process.env.EMAIL_PASS, // Your 16-character App Password
      },
    });

    // 3. Send the Mail: Awaiting ensures Vercel doesn't kill the process too early
    await transporter.sendMail({
      from: `"iPick Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your iPick Account",
      text: `Hello ${name || 'User'},\n\nYour verification code is: ${verificationCode}\n\nThis code will expire shortly.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2>Welcome to iPick!</h2>
          <p>Your verification code is:</p>
          <h1 style="color: #2563eb; letter-spacing: 5px;">${verificationCode}</h1>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // FIX: Log the error so you can see it in Vercel Dashboard > Logs
    console.error("SMTP Error:", error.message);
    return NextResponse.json({ error: "Email delivery failed. Check SMTP settings." }, { status: 500 });
  }
}