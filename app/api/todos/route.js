// app/api/todos/route.js
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

async function logActivity(db, action, details, userEmail) {
  await db.collection("activity_logs").insertOne({ action, details, userEmail, createdAt: new Date() });
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await clientPromise;
  const db = client.db("kanban_db");
  const { searchParams } = new URL(request.url);
  const usersFilter = searchParams.get("users")?.split(",").filter(Boolean) || [];

  const lists = await db.collection("lists").find({}).toArray();
  
  const pipeline = [
    { $lookup: { from: "users", localField: "userEmail", foreignField: "email", as: "authorDetails" } },
    { $addFields: { displayName: { $ifNull: [{ $arrayElemAt: ["$authorDetails.nickname", 0] }, "$userEmail"] } } },
    { $sort: { order: 1 } }
  ];

  if (usersFilter.length > 0) pipeline.unshift({ $match: { userEmail: { $in: usersFilter } } });
  
  const tasks = await db.collection("tasks").aggregate(pipeline).toArray();

  // SECURITY FIX: User Enumeration Protection. 
  // Only fetch metadata for users who have active tasks.
  const activeTaskEmails = [...new Set(tasks.map(t => t.userEmail))];
  const relevantUsers = await db.collection("users")
    .find({ email: { $in: activeTaskEmails } })
    .project({ email: 1, nickname: 1, name: 1 })
    .toArray();

  const logs = await db.collection("activity_logs").aggregate([
    { $lookup: { from: "users", localField: "userEmail", foreignField: "email", as: "authorDetails" } },
    { $addFields: { displayName: { $ifNull: [{ $arrayElemAt: ["$authorDetails.nickname", 0] }, "$userEmail"] } } },
    { $sort: { createdAt: -1 } },
    { $limit: 100 }
  ]).toArray();

  return NextResponse.json({ tasks, lists, logs, users: relevantUsers });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, data } = await request.json();
  const userEmail = session.user.email; // Identify user by session, not request body.
  const client = await clientPromise;
  const db = client.db("kanban_db");
  
  if (type === "list") {
    const result = await db.collection("lists").insertOne({ name: data.name });
    await logActivity(db, "ADD_LIST", `Created a new list: "${data.name}"`, userEmail);
    return NextResponse.json(result);
  }
  
  const result = await db.collection("tasks").insertOne({ text: data.text, listId: data.listId, userEmail, order: 999, createdAt: new Date() });
  await logActivity(db, "ADD_TASK", `Added a new task: "${data.text}"`, userEmail);
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
    await db.collection("lists").updateOne({ _id: new ObjectId(body.listId) }, { $set: { name: body.newName } });
    await logActivity(db, "EDIT_LIST", `Renamed a list to "${body.newName}"`, userEmail);
    return NextResponse.json({ success: true });
  }

  if (body.type === "edit_task") {
    // SECURITY FIX: Ensure user only edits their own task
    await db.collection("tasks").updateOne(
      { _id: new ObjectId(body.taskId), userEmail }, 
      { $set: { text: body.newText } }
    );
    await logActivity(db, "EDIT_TASK", `Updated task text to: "${body.newText}"`, userEmail);
    return NextResponse.json({ success: true });
  }

  if (body.bulk) {
    const bulkOps = body.tasks.map((task, index) => ({
      updateOne: { 
        filter: { _id: new ObjectId(task._id), userEmail }, 
        update: { $set: { listId: task.listId, order: index } } 
      }
    }));
    await db.collection("tasks").bulkWrite(bulkOps);
    if (body.logMessage) await logActivity(db, "MOVE_TASK", body.logMessage, userEmail);
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

  if (body.type === "all_logs") {
    // SECURITY FIX: Restrict global log deletion
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.type === "list") {
    await db.collection("lists").deleteOne({ _id: new ObjectId(body.listId) });
    await db.collection("tasks").deleteMany({ listId: body.listId }); 
    await logActivity(db, "DELETE_LIST", `Deleted a list and all enclosed tasks`, userEmail);
    return NextResponse.json({ success: true });
  }

  if (body.taskId) {
    const task = await db.collection("tasks").findOne({ _id: new ObjectId(body.taskId), userEmail });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    
    await db.collection("tasks").deleteOne({ _id: new ObjectId(body.taskId) });
    await logActivity(db, "DELETE_TASK", `Deleted task: "${task.text}"`, userEmail);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}