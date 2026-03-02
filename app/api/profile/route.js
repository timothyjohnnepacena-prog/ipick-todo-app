import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  age: z.union([z.string(), z.number()]).transform(val => parseInt(val, 10)).optional(),
  address: z.string().optional(),
  username: z.string().min(3, "Username must be at least 3 characters").max(30)
});

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawData = await request.json();
  
  const validation = profileSchema.safeParse(rawData);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
  }
  
  const { name, age, address, username } = validation.data;
  const client = await clientPromise;
  const db = client.db("kanban_db");

  const existingUser = await db.collection("users").findOne({ username });
  if (existingUser && existingUser.email !== session.user.email) {
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
  }

  await db.collection("users").updateOne(
    { email: session.user.email },
    { 
      $set: { 
        name, 
        age: age || null, 
        address: address || "", 
        username, 
        registered: true,
        updatedAt: new Date()
      } 
    }
  );

  return NextResponse.json({ success: true });
}