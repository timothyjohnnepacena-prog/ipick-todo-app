// app/api/todos/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { taskSchema, listSchema } from "@/lib/validation";

// Helper for security logging
async function logActivity(db, action, details, userEmail) {
  await db.collection("activity_logs").insertOne({ 
    action, 
    details, 
    userEmail, 
    createdAt: new Date() 
  });
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await clientPromise;
  const db = client.db("kanban_db");
  const userEmail = session.user.email;

  // Fetch only user-owned data
  const [lists, tasks, logs] = await Promise.all([
    db.collection("lists").find({ createdBy: userEmail }).toArray(),
    db.collection("tasks").find({ userEmail }).sort({ order: 1 }).toArray(),
    db.collection("activity_logs").find({ userEmail }).sort({ createdAt: -1 }).limit(50).toArray()
  ]);

  return NextResponse.json({ tasks, lists, logs });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, data } = await request.json();
  const userEmail = session.user.email;
  const client = await clientPromise;
  const db = client.db("kanban_db");
  
  if (type === "list") {
    listSchema.parse(data);
    const result = await db.collection("lists").insertOne({ 
      name: data.name, 
      createdBy: userEmail 
    });
    await logActivity(db, "ADD_LIST", `Created list: "${data.name}"`, userEmail);
    return NextResponse.json(result);
  }
  
  taskSchema.parse(data);
  // Verify list ownership before adding a task to it
  const list = await db.collection("lists").findOne({ _id: new ObjectId(data.listId), createdBy: userEmail });
  if (!list) return NextResponse.json({ error: "Invalid List" }, { status: 403 });

  const result = await db.collection("tasks").insertOne({ 
    text: data.text, 
    listId: data.listId, 
    userEmail, 
    order: 999, 
    createdAt: new Date() 
  });
  await logActivity(db, "ADD_TASK", `Added task: "${data.text}"`, userEmail);
  return NextResponse.json(result);
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");
  const userEmail = session.user.email;

  if (body.type === "list") {
    // Verify ownership before renaming
    const result = await db.collection("lists").updateOne(
      { _id: new ObjectId(body.listId), createdBy: userEmail },
      { $set: { name: body.newName } }
    );
    if (result.matchedCount === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: true });
  }

  if (body.bulk) {
    // Verify all tasks being moved belong to the user
    const bulkOps = body.tasks.map((task, index) => ({
      updateOne: { 
        filter: { _id: new ObjectId(task._id), userEmail }, 
        update: { $set: { listId: task.listId, order: index } } 
      }
    }));
    const result = await db.collection("tasks").bulkWrite(bulkOps);
    return NextResponse.json({ success: true, modified: result.modifiedCount });
  }

  return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");
  const userEmail = session.user.email;

  if (body.taskId) {
    // Ensure userEmail matches the task owner
    const result = await db.collection("tasks").deleteOne({ 
      _id: new ObjectId(body.taskId), 
      userEmail 
    });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    return NextResponse.json({ success: true });
  }
  
  if (body.listId) {
    // Delete list AND its tasks only if owner matches
    await db.collection("tasks").deleteMany({ listId: body.listId, userEmail });
    await db.collection("lists").deleteOne({ _id: new ObjectId(body.listId), createdBy: userEmail });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
}