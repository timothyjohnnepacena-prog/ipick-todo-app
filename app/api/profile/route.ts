import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, getServerEmail } from "../auth/[...nextauth]/route";
import { z } from "zod";
import { apiRatelimit } from "@/lib/ratelimit";
import { headers } from "next/headers";

const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
    age: z.union([z.string(), z.number()]).transform(val => parseInt(String(val), 10)).optional(),
    address: z.string().max(250, "Address is too long").optional(),
    username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username is too long")
});

export async function POST(request: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serverEmail = await getServerEmail(request);
    if (!serverEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
    const { success } = await apiRatelimit.limit(`profile_${ip}`);
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const rawData = await request.json();

    const validation = profileSchema.safeParse(rawData);
    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { name, age, address, username } = validation.data;
    const client = await clientPromise;
    const db = client.db("kanban_db");

    const existingUser = await db.collection("users").findOne({ username });
    if (existingUser && existingUser.email !== serverEmail) {
        return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }

    await db.collection("users").updateOne(
        { email: serverEmail },
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
