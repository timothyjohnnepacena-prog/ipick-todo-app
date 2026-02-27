import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, age, address, username } = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");

  // We update the existing user document created by NextAuth
  await db.collection("users").updateOne(
    { email: session.user.email },
    { 
      $set: { 
        name, 
        age: parseInt(age), 
        address, 
        username, 
        registered: true,
        updatedAt: new Date()
      } 
    }
  );

  return NextResponse.json({ success: true });
}