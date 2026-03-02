import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { z } from "zod";

export const dynamic = "force-dynamic";

const sanitize = (str) => typeof str === "string" ? str.replace(/[<>]/g, "").trim() : "";

const taskSchema = z.object({
  text: z.string().min(1).max(500),
  listId: z.string(),
});

const listSchema = z.object({
  name: z.string().min(1).max(100),
});

async function logActivity(db, action, details, userEmail) {
  await db.collection("activity_logs").insertOne({ action, details, userEmail, createdAt: new Date() });
}

const isValidId = (id) => ObjectId.isValid(id) && (String(new ObjectId(id)) === id);

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await clientPromise;
  const db = client.db("kanban_db");
  const { searchParams } = new URL(request.url);
  const usersFilter = searchParams.get("users")?.split(",").filter(Boolean) || [];

  const activeTaskEmails = await db.collection("tasks").distinct("userEmail");
  const relevantEmails = [...new Set([...activeTaskEmails, session.user.email])];

  const rawActiveUsers = await db.collection("users")
    .find({ email: { $in: relevantEmails } })
    .project({ _id: 1, nickname: 1, name: 1 })
    .toArray();

  // Send stable IDs so the frontend highlight doesn't break
  const activeUsers = rawActiveUsers.map(user => ({
    _id: user._id.toString(),
    name: user.nickname || user.name
  }));

  const lists = await db.collection("lists").find({}).toArray();

  let filterEmails = [];
  if (usersFilter.length > 0) {
    const filterIds = usersFilter.filter(isValidId).map(id => new ObjectId(id));
    if (filterIds.length > 0) {
      const usersWithEmails = await db.collection("users").find({ _id: { $in: filterIds } }).project({ email: 1 }).toArray();
      filterEmails = usersWithEmails.map(u => u.email);
    }
  }

  const pipeline = [
    { $lookup: { from: "users", localField: "userEmail", foreignField: "email", as: "authorDetails" } },
    { $addFields: { displayName: { $ifNull: [{ $arrayElemAt: ["$authorDetails.nickname", 0] }, { $arrayElemAt: ["$authorDetails.name", 0] }, "User"] } } },
    { $project: { userEmail: 0, authorDetails: 0 } },
    { $sort: { order: 1 } }
  ];

  if (filterEmails.length > 0) {
    pipeline.unshift({ $match: { userEmail: { $in: filterEmails } } });
  } else if (usersFilter.length > 0) {
    pipeline.unshift({ $match: { userEmail: "INVALID_FORCE_EMPTY" } });
  }

  const tasks = await db.collection("tasks").aggregate(pipeline).toArray();
  const logs = await db.collection("activity_logs").aggregate([
    { $lookup: { from: "users", localField: "userEmail", foreignField: "email", as: "authorDetails" } },
    { $addFields: { displayName: { $ifNull: [{ $arrayElemAt: ["$authorDetails.nickname", 0] }, { $arrayElemAt: ["$authorDetails.name", 0] }, "User"] } } },
    { $project: { userEmail: 0, authorDetails: 0 } },
    { $sort: { createdAt: -1 } },
    { $limit: 100 }
  ]).toArray();

  return NextResponse.json({ tasks, lists, logs, users: activeUsers });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const secureEmail = session.user.email;
  const { type, data } = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");

  if (type === "list") {
    const listValidation = listSchema.safeParse(data);
    if (!listValidation.success) return NextResponse.json({ error: "Invalid list name" }, { status: 400 });
    const safeName = sanitize(listValidation.data.name);
    const result = await db.collection("lists").insertOne({ name: safeName });
    await logActivity(db, "ADD_LIST", `Created a new list: "${safeName}"`, secureEmail);
    return NextResponse.json(result);
  }

  const taskValidation = taskSchema.safeParse(data);
  if (!taskValidation.success) return NextResponse.json({ error: "Invalid task data" }, { status: 400 });
  if (!isValidId(taskValidation.data.listId)) return NextResponse.json({ error: "Invalid List ID" }, { status: 400 });
  const safeText = sanitize(taskValidation.data.text);
  const result = await db.collection("tasks").insertOne({ text: safeText, listId: taskValidation.data.listId, userEmail: secureEmail, order: 999, createdAt: new Date() });
  await logActivity(db, "ADD_TASK", `Added a new task: "${safeText}"`, secureEmail);
  return NextResponse.json(result);
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const secureEmail = session.user.email;
  const body = await request.json();
  const client = await clientPromise;
  const kanbanDb = client.db("kanban_db");

  if (body.type === "list") {
    if (!isValidId(body.listId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    const safeNewName = sanitize(String(body.newName || "").slice(0, 100));
    if (!safeNewName) return NextResponse.json({ error: "List name is required" }, { status: 400 });
    await kanbanDb.collection("lists").updateOne({ _id: new ObjectId(body.listId) }, { $set: { name: safeNewName } });
    await logActivity(kanbanDb, "EDIT_LIST", `Renamed a list to "${safeNewName}"`, secureEmail);
    return NextResponse.json({ success: true });
  }

  if (body.type === "edit_task") {
    if (!isValidId(body.taskId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    const safeNewText = sanitize(String(body.newText || "").slice(0, 500));
    if (!safeNewText) return NextResponse.json({ error: "Task text is required" }, { status: 400 });

    const result = await kanbanDb.collection("tasks").updateOne(
      { _id: new ObjectId(body.taskId) },
      { $set: { text: safeNewText } }
    );
    if (result.matchedCount === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    await logActivity(kanbanDb, "EDIT_TASK", `Updated task text to: "${safeNewText}"`, secureEmail);
    return NextResponse.json({ success: true });
  }

  if (body.bulk) {
    const validTasks = body.tasks.filter(t => isValidId(t._id));
    const bulkOps = validTasks.map((task, index) => ({
      updateOne: {
        filter: { _id: new ObjectId(task._id) },
        update: { $set: { listId: task.listId, order: index } }
      }
    }));
    if (bulkOps.length > 0) await kanbanDb.collection("tasks").bulkWrite(bulkOps);
    if (body.logMessage) {
      const safeLogMsg = sanitize(String(body.logMessage).slice(0, 200));
      await logActivity(kanbanDb, "MOVE_TASK", safeLogMsg, secureEmail);
    }
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const secureEmail = session.user.email;
  const body = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");

  if (body.type === "all_logs") {
    if (secureEmail !== process.env.ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await db.collection("activity_logs").deleteMany({});
    return NextResponse.json({ success: true });
  }

  if (body.type === "list") {
    if (!isValidId(body.listId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    await db.collection("lists").deleteOne({ _id: new ObjectId(body.listId) });
    await db.collection("tasks").deleteMany({ listId: body.listId });
    await logActivity(db, "DELETE_LIST", `Deleted a list and all enclosed tasks`, secureEmail);
    return NextResponse.json({ success: true });
  }

  if (body.taskId) {
    if (!isValidId(body.taskId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const task = await db.collection("tasks").findOne({ _id: new ObjectId(body.taskId) });
    if (task) {
      await db.collection("tasks").deleteOne({ _id: new ObjectId(body.taskId) });
      await logActivity(db, "DELETE_TASK", `Deleted task: "${task.text}"`, secureEmail);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}