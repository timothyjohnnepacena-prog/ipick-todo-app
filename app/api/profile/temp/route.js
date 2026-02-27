import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(request) {
  try {
    const data = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    // 1. Check if the user is already fully registered in the 'users' collection
    if (!data.resendOnly) {
      const existingUser = await db.collection("users").findOne({
        $or: [
          { email: data.email },
          { username: data.username }
        ]
      });

      if (existingUser) {
        if (existingUser.email === data.email) {
          return NextResponse.json({ error: "Email address is already registered." }, { status: 400 });
        }
        if (existingUser.username === data.username) {
          return NextResponse.json({ error: "Username is already taken." }, { status: 400 });
        }
      }
    }

    // 2. Hash the password if this is a new registration (not just a code resend)
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
      delete data.confirmPassword;
    }

    // 3. Handle the temporary registration data
    if (data.resendOnly) {
      await db.collection("temp_registrations").updateOne(
        { email: data.email },
        { $set: { verificationCode: data.verificationCode } }
      );
    } else {
      await db.collection("temp_registrations").updateOne(
        { email: data.email },
        { $set: { ...data, createdAt: new Date() } },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}