// app/api/todos/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { taskSchema, listSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  if (!rateLimit(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, data } = body;
  const userEmail = session.user.email;
  const client = await clientPromise;
  const db = client.db("kanban_db");

  try {
    if (type === "list") {
      const validated = listSchema.parse(data);
      const result = await db.collection("lists").insertOne({ 
        name: validated.name, 
        createdBy: userEmail 
      });
      return NextResponse.json(result);
    }

    const validatedTask = taskSchema.parse(data);
    const result = await db.collection("tasks").insertOne({ 
      text: validatedTask.text, 
      listId: validatedTask.listId, 
      userEmail, 
      order: 999, 
      createdAt: new Date() 
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
  }
}