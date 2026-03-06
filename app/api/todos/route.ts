import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId, Db } from "mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions, getServerEmail } from "../auth/[...nextauth]/route";
import { z } from "zod";
import { apiRatelimit } from "@/lib/ratelimit";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const sanitize = (str: string): string =>
    typeof str === "string" ? str.replace(/[<>]/g, "").trim() : "";

const taskSchema = z.object({
    text: z.string().min(1).max(500),
    listId: z.string(),
});

const listSchema = z.object({
    name: z.string().min(1).max(100),
});

interface BulkTask {
    _id: string;
    listId: string;
}

async function logActivity(db: Db, action: string, details: string, userEmail: string): Promise<void> {
    await db.collection("activity_logs").insertOne({ action, details, userEmail, createdAt: new Date() });
}

const isValidId = (id: string): boolean =>
    ObjectId.isValid(id) && String(new ObjectId(id)) === id;

export async function GET(request: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serverEmail = await getServerEmail(request);
    if (!serverEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
    const { success: rlSuccess } = await apiRatelimit.limit(`todos_get_${ip}`);
    if (!rlSuccess) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const client = await clientPromise;
    const db = client.db("kanban_db");
    const { searchParams } = new URL(request.url);
    const usersFilter = searchParams.get("users")?.split(",").filter(Boolean) || [];

    const [activeTaskEmails, lists, logs] = await Promise.all([
        db.collection("tasks").distinct("userEmail"),
        db.collection("lists").find({ userEmail: serverEmail }).toArray(),
        db.collection("activity_logs").aggregate([
            { $lookup: { from: "users", localField: "userEmail", foreignField: "email", as: "authorDetails" } },
            { $addFields: { displayName: { $ifNull: [{ $arrayElemAt: ["$authorDetails.nickname", 0] }, { $arrayElemAt: ["$authorDetails.name", 0] }, "User"] } } },
            { $project: { userEmail: 0, authorDetails: 0 } },
            { $sort: { createdAt: -1 } },
            { $limit: 100 }
        ]).toArray()
    ]);

    const relevantEmails = [...new Set([...activeTaskEmails, serverEmail])];

    const rawActiveUsers = await db.collection("users")
        .find({ email: { $in: relevantEmails } })
        .project({ _id: 1, nickname: 1, name: 1 })
        .toArray();

    const activeUsers = rawActiveUsers.map(user => ({
        _id: user._id.toString(),
        name: (user.nickname || user.name) as string
    }));

    const safeLists = lists.map(l => ({ _id: l._id.toString(), name: l.name }));

    let filterEmails: string[] = [];
    if (usersFilter.length > 0) {
        const filterIds = usersFilter.filter(isValidId).map(id => new ObjectId(id));
        if (filterIds.length > 0) {
            const usersWithEmails = await db.collection("users").find({ _id: { $in: filterIds }, email: { $in: activeTaskEmails } }).project({ email: 1 }).toArray();
            filterEmails = usersWithEmails.map(u => u.email as string);
        }
    }

    const pipeline: any[] = [
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

    const safeTasks = tasks.map(t => ({
        _id: t._id.toString(),
        text: t.text,
        listId: t.listId,
        listName: t.listName || null,
        order: t.order,
        displayName: t.displayName,
        createdAt: t.createdAt,
        completedAt: t.completedAt || null,
        completed: !!t.completed,
        status: t.status || "pending",
    }));

    const safeLogs = logs.map(l => ({
        _id: l._id.toString(),
        action: l.action,
        details: l.details,
        displayName: l.displayName,
        createdAt: l.createdAt,
    }));

    const res = NextResponse.json({ tasks: safeTasks, lists: safeLists, logs: safeLogs, users: activeUsers });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    return res;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serverEmail = await getServerEmail(request);
    if (!serverEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
    const { success: rlSuccess } = await apiRatelimit.limit(`todos_post_${ip}`);
    if (!rlSuccess) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const { type, data } = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    if (type === "list") {
        const listValidation = listSchema.safeParse(data);
        if (!listValidation.success) return NextResponse.json({ error: "Invalid list name" }, { status: 400 });
        const safeName = sanitize(listValidation.data.name);
        const result = await db.collection("lists").insertOne({ name: safeName, userEmail: serverEmail });
        await logActivity(db, "ADD_LIST", `Created a new list: "${safeName}"`, serverEmail);
        return NextResponse.json({ success: true, insertedId: result.insertedId.toString() });
    }

    const taskValidation = taskSchema.safeParse(data);
    if (!taskValidation.success) return NextResponse.json({ error: "Invalid task data" }, { status: 400 });
    if (!isValidId(taskValidation.data.listId)) return NextResponse.json({ error: "Invalid List ID" }, { status: 400 });
    const safeText = sanitize(taskValidation.data.text);
    await db.collection("tasks").insertOne({ text: safeText, listId: taskValidation.data.listId, userEmail: serverEmail, order: 999, createdAt: new Date(), completed: false });
    await logActivity(db, "ADD_TASK", `Added a new task: "${safeText}"`, serverEmail);
    return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serverEmail = await getServerEmail(request);
    if (!serverEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
    const { success: rlSuccess } = await apiRatelimit.limit(`todos_patch_${ip}`);
    if (!rlSuccess) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const body = await request.json();
    const client = await clientPromise;
    const kanbanDb = client.db("kanban_db");

    if (body.type === "list") {
        if (!isValidId(body.listId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        const safeNewName = sanitize(String(body.newName || "").slice(0, 100));
        if (!safeNewName) return NextResponse.json({ error: "List name is required" }, { status: 400 });

        const result = await kanbanDb.collection("lists").updateOne({ _id: new ObjectId(body.listId), userEmail: serverEmail }, { $set: { name: safeNewName } });
        if (result.matchedCount === 0) return NextResponse.json({ error: "List not found" }, { status: 404 });

        await logActivity(kanbanDb, "EDIT_LIST", `Renamed a list to "${safeNewName}"`, serverEmail);
        return NextResponse.json({ success: true });
    }

    if (body.type === "edit_task") {
        if (!isValidId(body.taskId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        const safeNewText = sanitize(String(body.newText || "").slice(0, 500));
        if (!safeNewText) return NextResponse.json({ error: "Task text is required" }, { status: 400 });

        const result = await kanbanDb.collection("tasks").updateOne(
            { _id: new ObjectId(body.taskId), userEmail: serverEmail },
            { $set: { text: safeNewText } }
        );
        if (result.matchedCount === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });
        await logActivity(kanbanDb, "EDIT_TASK", `Updated task text to: "${safeNewText}"`, serverEmail);
        return NextResponse.json({ success: true });
    }

    if (body.type === "update_status") {
        if (!isValidId(body.taskId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        const validStatuses = ["pending", "in_progress"];
        if (!validStatuses.includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

        const result = await kanbanDb.collection("tasks").updateOne(
            { _id: new ObjectId(body.taskId), userEmail: serverEmail },
            { $set: { status: body.status } }
        );
        if (result.matchedCount === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });
        const statusLabel = body.status === "in_progress" ? "In Progress" : "Pending";
        await logActivity(kanbanDb, "EDIT_TASK", `Changed task status to "${statusLabel}"`, serverEmail);
        return NextResponse.json({ success: true });
    }

    if (body.type === "mark_done") {
        if (!isValidId(body.taskId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        const taskToComplete = await kanbanDb.collection("tasks").findOne({ _id: new ObjectId(body.taskId), userEmail: serverEmail });
        if (!taskToComplete) return NextResponse.json({ error: "Task not found" }, { status: 404 });

        let listName = "Deleted List";
        if (taskToComplete.listId && isValidId(taskToComplete.listId)) {
            const list = await kanbanDb.collection("lists").findOne({ _id: new ObjectId(taskToComplete.listId) });
            if (list) listName = list.name;
        }

        const result = await kanbanDb.collection("tasks").findOneAndUpdate(
            { _id: new ObjectId(body.taskId), userEmail: serverEmail },
            { $set: { completed: true, completedAt: new Date(), listName, status: "done" } },
            { returnDocument: "after" }
        );

        if (!result) return NextResponse.json({ error: "Task not found" }, { status: 404 });

        await logActivity(kanbanDb, "COMPLETE_TASK", `Marked task as done: "${result.text}"`, serverEmail);
        return NextResponse.json({ success: true });
    }

    if (body.bulk) {
        const validTasks = (body.tasks as BulkTask[]).filter((t) => isValidId(t._id));
        const bulkOps = validTasks.map((task, index) => ({
            updateOne: {
                filter: { _id: new ObjectId(task._id), userEmail: serverEmail },
                update: { $set: { listId: task.listId, order: index } }
            }
        }));
        if (bulkOps.length > 0) await kanbanDb.collection("tasks").bulkWrite(bulkOps);
        if (body.logMessage) {
            const safeLogMsg = sanitize(String(body.logMessage).slice(0, 200));
            await logActivity(kanbanDb, "MOVE_TASK", safeLogMsg, serverEmail);
        }
        return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serverEmail = await getServerEmail(request);
    if (!serverEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
    const { success: rlSuccess } = await apiRatelimit.limit(`todos_delete_${ip}`);
    if (!rlSuccess) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db("kanban_db");

    if (body.type === "all_logs") {
        await db.collection("activity_logs").deleteMany({});
        return NextResponse.json({ success: true });
    }

    if (body.type === "list") {
        if (!isValidId(body.listId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        const list = await db.collection("lists").findOne({ _id: new ObjectId(body.listId), userEmail: serverEmail });
        if (list) {
            const activeTaskCount = await db.collection("tasks").countDocuments({ listId: body.listId, completed: { $ne: true } });
            if (activeTaskCount > 0) {
                return NextResponse.json({ error: "List still has active tasks" }, { status: 400 });
            }

            await db.collection("tasks").deleteMany({ listId: body.listId, completed: { $ne: true } });
            await db.collection("lists").deleteOne({ _id: new ObjectId(body.listId) });
            await logActivity(db, "DELETE_LIST", `Deleted list: "${list.name}"`, serverEmail);
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (body.taskId) {
        if (!isValidId(body.taskId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        const task = await db.collection("tasks").findOne({ _id: new ObjectId(body.taskId), userEmail: serverEmail });
        if (task) {
            await db.collection("tasks").deleteOne({ _id: new ObjectId(body.taskId), userEmail: serverEmail });
            await logActivity(db, "DELETE_TASK", `Deleted task: "${task.text}"`, serverEmail);
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}