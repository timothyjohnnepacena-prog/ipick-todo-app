import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

async function logActivity(db, action, details, userEmail) {
  await db.collection("activity_logs").insertOne({ action, details, userEmail, createdAt: new Date() });
}

export async function GET(request) {
  const client = await clientPromise;
  const db = client.db("kanban_db");
  const { searchParams } = new URL(request.url);
  const usersFilter = searchParams.get("users")?.split(",").filter(Boolean) || [];

  // NEW: Fetch ALL registered users from the database
  const allUsers = await db.collection("users").find({}).project({ email: 1, nickname: 1, name: 1 }).toArray();

  const lists = await db.collection("lists").find({}).toArray();
  const pipeline = [
    { $lookup: { from: "users", localField: "userEmail", foreignField: "email", as: "authorDetails" } },
    { $addFields: { displayName: { $ifNull: [{ $arrayElemAt: ["$authorDetails.nickname", 0] }, "$userEmail"] } } },
    { $sort: { order: 1 } }
  ];

  if (usersFilter.length > 0) pipeline.unshift({ $match: { userEmail: { $in: usersFilter } } });
  
  const tasks = await db.collection("tasks").aggregate(pipeline).toArray();
  const logs = await db.collection("activity_logs").aggregate([
    { $lookup: { from: "users", localField: "userEmail", foreignField: "email", as: "authorDetails" } },
    { $addFields: { displayName: { $ifNull: [{ $arrayElemAt: ["$authorDetails.nickname", 0] }, "$userEmail"] } } },
    { $sort: { createdAt: -1 } },
    { $limit: 100 }
  ]).toArray();

  // Return the users list along with tasks, lists, and logs
  return NextResponse.json({ tasks, lists, logs, users: allUsers });
}

export async function POST(request) {
  const { type, data, userEmail } = await request.json();
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
  const body = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");
  const userEmail = body.userEmail || "System";

  if (body.type === "list") {
    await db.collection("lists").updateOne({ _id: new ObjectId(body.listId) }, { $set: { name: body.newName } });
    await logActivity(db, "EDIT_LIST", `Renamed a list to "${body.newName}"`, userEmail);
    return NextResponse.json({ success: true });
  }

  if (body.type === "edit_task") {
    await db.collection("tasks").updateOne({ _id: new ObjectId(body.taskId) }, { $set: { text: body.newText } });
    await logActivity(db, "EDIT_TASK", `Updated task text to: "${body.newText}"`, userEmail);
    return NextResponse.json({ success: true });
  }

  if (body.bulk) {
    const bulkOps = body.tasks.map((task, index) => ({
      updateOne: { filter: { _id: new ObjectId(task._id) }, update: { $set: { listId: task.listId, order: index } } }
    }));
    await db.collection("tasks").bulkWrite(bulkOps);
    if (body.logMessage) await logActivity(db, "MOVE_TASK", body.logMessage, userEmail);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const body = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");
  const userEmail = body.userEmail || "System";

  if (body.type === "all_logs") {
    await db.collection("activity_logs").deleteMany({});
    return NextResponse.json({ success: true });
  }

  if (body.type === "list") {
    await db.collection("lists").deleteOne({ _id: new ObjectId(body.listId) });
    await db.collection("tasks").deleteMany({ listId: body.listId }); 
    await logActivity(db, "DELETE_LIST", `Deleted a list and all enclosed tasks`, userEmail);
    return NextResponse.json({ success: true });
  }

  if (body.taskId) {
    const task = await db.collection("tasks").findOne({ _id: new ObjectId(body.taskId) });
    await db.collection("tasks").deleteOne({ _id: new ObjectId(body.taskId) });
    await logActivity(db, "DELETE_TASK", `Deleted task: "${task?.text || "Unknown"}"`, userEmail);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}