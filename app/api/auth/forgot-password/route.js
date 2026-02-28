import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer"; 

export async function POST(request) {
  try {
    const { email } = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return NextResponse.json({ error: "No account found with this email" }, { status: 404 });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    await db.collection("password_resets").updateOne(
      { email },
      { $set: { email, code: resetCode, createdAt: new Date() } },
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}