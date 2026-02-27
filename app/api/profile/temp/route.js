import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(request) {
  try {
    const data = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    // Hash the password with 10 salt rounds
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
      // Delete confirmPassword so it isn't saved in the DB
      delete data.confirmPassword;
    }

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