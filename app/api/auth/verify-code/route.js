import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST(request) {
  const { email, code } = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");

  const tempUser = await db.collection("temp_registrations").findOne({ email });

  if (!tempUser || tempUser.verificationCode !== code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Move details including nickname to real collection
  await db.collection("users").updateOne(
    { email },
    { 
      $set: { 
        name: tempUser.name, 
        nickname: tempUser.nickname, // Saving nickname
        username: tempUser.username, 
        password: tempUser.password,
        registered: true 
      } 
    },
    { upsert: true }
  );

  await db.collection("temp_registrations").deleteOne({ email });
  return NextResponse.json({ success: true });
}