import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const { email, code } = await request.json();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; background-color: #F1F3F6; padding: 40px 20px; text-align: center; color: #334155;">
        <div style="max-w-md mx-auto; background-color: #ffffff; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 500px; margin: 0 auto; border-top: 6px solid #12A55C;">
          <h1 style="color: #12A55C; font-size: 28px; margin-bottom: 8px; font-weight: 900; letter-spacing: -0.5px;">iPick Center</h1>
          <p style="color: #94A3B8; font-size: 14px; margin-top: 0; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Account Security</p>
          <h2 style="color: #1E293B; font-size: 20px; margin-bottom: 16px;">Your Verification Code</h2>
          <p style="color: #64748B; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
            You recently requested to verify your account or reset your password. Please use the 6-digit security code below to complete the process.
          </p>
          <div style="background-color: #F8FAFC; border: 2px dashed #E2E8F0; padding: 20px; border-radius: 16px; margin-bottom: 30px;">
            <span style="font-size: 32px; font-weight: 900; color: #F37A22; letter-spacing: 8px; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #94A3B8; font-size: 12px; line-height: 1.5;">
            If you did not request this code, please ignore this email or contact your system administrator. This code will expire shortly.
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"iPick Center Board" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your iPick Center Verification Code",
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}