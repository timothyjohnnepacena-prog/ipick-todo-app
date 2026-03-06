import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ratelimit } from "@/lib/ratelimit";
import { headers } from "next/headers";

const verifySchema = z.object({
    email: z.string().email(),
    code: z.string().length(6, "Code must be exactly 6 digits")
});

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const headersList = await headers();
        const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
        const { success: rateLimitSuccess } = await ratelimit.limit(`verify_${ip}`);
        if (!rateLimitSuccess) {
            return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
        }

        const rawData = await request.json();

        const validation = verifySchema.safeParse(rawData);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        const { email, code } = validation.data;

        const { success: emailRateLimitSuccess } = await ratelimit.limit(`verify_email_${email}`);
        if (!emailRateLimitSuccess) {
            return NextResponse.json({ error: "Too many attempts for this email. Please try again later." }, { status: 429 });
        }

        const client = await clientPromise;
        const db = client.db("kanban_db");

        const tempUser = await db.collection("temp_registrations").findOne({ email });

        if (!tempUser || tempUser.verificationCode !== code) {
            return NextResponse.json({ error: "Invalid code" }, { status: 400 });
        }

        await db.collection("users").updateOne(
            { email },
            {
                $set: {
                    name: tempUser.name,
                    nickname: tempUser.nickname,
                    username: tempUser.username,
                    password: tempUser.password,
                    registered: true,
                    isVerifiedByAdmin: false
                }
            },
            { upsert: true }
        );

        await db.collection("temp_registrations").deleteOne({ email });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
