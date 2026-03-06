import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { z } from "zod";
import { ratelimit } from "@/lib/ratelimit";
import { headers } from "next/headers";

const resetSchema = z.object({
    email: z.string().email("Invalid email address"),
    code: z.string().length(6, "Code must be exactly 6 digits"),
    newPassword: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain an uppercase letter")
        .regex(/[a-z]/, "Password must contain a lowercase letter")
        .regex(/[0-9]/, "Password must contain a number"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const headersList = await headers();
        const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
        const { success } = await ratelimit.limit(`reset_${ip}`);
        if (!success) {
            return NextResponse.json(
                { error: "Too many attempts. Please try again later." },
                { status: 429 }
            );
        }

        const rawData = await request.json();
        const validation = resetSchema.safeParse(rawData);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            );
        }

        const { email, code, newPassword } = validation.data;

        const { success: emailRateLimitSuccess } = await ratelimit.limit(`reset_email_${email}`);
        if (!emailRateLimitSuccess) {
            return NextResponse.json({ error: "Too many attempts for this email. Please try again later." }, { status: 429 });
        }

        const client = await clientPromise;
        const db = client.db("kanban_db");

        const resetEntry = await db.collection("password_resets").findOne({ email });

        if (!resetEntry) {
            return NextResponse.json(
                { error: "Invalid or expired reset code" },
                { status: 400 }
            );
        }

        const now = new Date();
        const codeAge = (now.getTime() - new Date(resetEntry.createdAt as string).getTime()) / 1000 / 60;
        if (codeAge > 60) {
            await db.collection("password_resets").deleteOne({ email });
            return NextResponse.json(
                { error: "Reset code has expired" },
                { status: 400 }
            );
        }

        const hashedInputCode = crypto
            .createHash("sha256")
            .update(code)
            .digest("hex");

        if (hashedInputCode !== resetEntry.code) {
            return NextResponse.json(
                { error: "Invalid or expired reset code" },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const updateResult = await db
            .collection("users")
            .updateOne({ email }, { $set: { password: hashedPassword } });

        if (updateResult.modifiedCount === 0) {
            return NextResponse.json(
                { error: "Failed to update password" },
                { status: 500 }
            );
        }

        await db.collection("password_resets").deleteOne({ email });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Reset Password Error:", err);
        return NextResponse.json(
            { error: "Something went wrong. Please try again later." },
            { status: 500 }
        );
    }
}
