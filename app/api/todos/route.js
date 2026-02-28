// app/api/todos/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { taskSchema, listSchema } from "@/lib/validation";

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

  // 1. Fetch only the current user's lists [SECURITY: Isolation]
  const lists = await db.collection("lists").find({ createdBy: userEmail }).toArray();
  
  // 2. Fetch only the current user's tasks
  const tasks = await db.collection("tasks")
    .find({ userEmail })
    .sort({ order: 1 })
    .toArray();

  // 3. Fetch only the current user's logs
  const logs = await db.collection("activity_logs")
    .find({ userEmail })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

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
      createdBy: userEmail // Ensure ownership is set
    });
    await logActivity(db, "ADD_LIST", `Created list: "${data.name}"`, userEmail);
    return NextResponse.json(result);
  }
  
  taskSchema.parse(data);
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
    // SECURITY: Verify list ownership before editing
    const result = await db.collection("lists").updateOne(
      { _id: new ObjectId(body.listId), createdBy: userEmail },
      { $set: { name: body.newName } }
    );
    if (result.matchedCount === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    
    await logActivity(db, "EDIT_LIST", `Renamed list to "${body.newName}"`, userEmail);
    return NextResponse.json({ success: true });
  }

  if (body.bulk) {
    // SECURITY: Prevent IDOR by verifying all target lists belong to the user
    const targetListIds = [...new Set(body.tasks.map(t => t.listId))];
    const userLists = await db.collection("lists")
      .find({ 
        _id: { $in: targetListIds.map(id => new ObjectId(id)) }, 
        createdBy: userEmail 
      })
      .toArray();

    if (userLists.length !== targetListIds.length) {
      return NextResponse.json({ error: "Unauthorized list access" }, { status: 403 });
    }

    const bulkOps = body.tasks.map((task, index) => ({
      updateOne: { 
        filter: { _id: new ObjectId(task._id), userEmail }, 
        update: { $set: { listId: task.listId, order: index } } 
      }
    }));
    await db.collection("tasks").bulkWrite(bulkOps);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");
  const userEmail = session.user.email;

  if (body.taskId) {
    const result = await db.collection("tasks").deleteOne({ 
      _id: new ObjectId(body.taskId), 
      userEmail 
    });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    await logActivity(db, "DELETE_TASK", `Deleted a task`, userEmail);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}