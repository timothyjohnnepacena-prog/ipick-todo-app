import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import crypto from "crypto";

// 🛡️ SECURITY UPGRADE: ID Encryption System
const ENCRYPTION_KEY = crypto.scryptSync(process.env.NEXTAUTH_SECRET || "default_secret", 'salt', 32);

function encryptId(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text.toString());
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptId(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return null;
  }
}

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

  // 1. Find only the active users on this specific board
  const activeTaskEmails = await db.collection("tasks").distinct("userEmail");
  const relevantEmails = [...new Set([...activeTaskEmails, session.user.email])];

  const rawActiveUsers = await db.collection("users")
    .find({ email: { $in: relevantEmails } })
    .project({ _id: 1, nickname: 1, name: 1 })
    .toArray();

  // 🛡️ SECURITY UPGRADE: Scramble the IDs and merge nickname into name
  const activeUsers = rawActiveUsers.map(user => ({
    _id: encryptId(user._id.toString()), // Sends encrypted placeholder
    name: user.nickname || user.name     // Only sends one display name field
  }));

  const lists = await db.collection("lists").find({}).toArray();
  
  // Decrypt incoming filter placeholders back into real Database IDs
  let filterEmails = [];
  if (usersFilter.length > 0) {
      const filterIds = usersFilter.map(decryptId).filter(id => id && isValidId(id)).map(id => new ObjectId(id));
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
    const result = await db.collection("lists").insertOne({ name: data.name });
    await logActivity(db, "ADD_LIST", `Created a new list: "${data.name}"`, secureEmail);
    return NextResponse.json(result);
  }
  
  if (!isValidId(data.listId)) return NextResponse.json({ error: "Invalid List ID" }, { status: 400 });

  const result = await db.collection("tasks").insertOne({ text: data.text, listId: data.listId, userEmail: secureEmail, order: 999, createdAt: new Date() });
  await logActivity(db, "ADD_TASK", `Added a new task: "${data.text}"`, secureEmail);
  return NextResponse.json(result);
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const secureEmail = session.user.email;

  const body = await request.json();
  const client = await clientPromise;
  const db = client.db("kanban_db");

  if (body.type === "list") {
    if (!isValidId(body.listId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    await db.collection("lists").updateOne({ _id: new ObjectId(body.listId) }, { $set: { name: body.newName } });
    await logActivity(db, "EDIT_LIST", `Renamed a list to "${body.newName}"`, secureEmail);
    return NextResponse.json({ success: true });
  }

  if (body.type === "edit_task") {
    if (!isValidId(body.taskId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    await db.collection("tasks").updateOne({ _id: new ObjectId(body.taskId) }, { $set: { text: body.newText } });
    await logActivity(db, "EDIT_TASK", `Updated task text to: "${body.newText}"`, secureEmail);
    return NextResponse.json({ success: true });
  }

  if (body.bulk) {
    const validTasks = body.tasks.filter(t => isValidId(t._id));
    const bulkOps = validTasks.map((task, index) => ({
      updateOne: { filter: { _id: new ObjectId(task._id) }, update: { $set: { listId: task.listId, order: index } } }
    }));
    if (bulkOps.length > 0) {
      await db.collection("tasks").bulkWrite(bulkOps);
    }
    if (body.logMessage) await logActivity(db, "MOVE_TASK", body.logMessage, secureEmail);
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
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}