import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "@/lib/mongodb";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { z } from "zod";
import { ratelimit } from "@/lib/ratelimit";
import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

const loginSchema = z.object({
    identifier: z.string().min(3),
    password: z.string().min(1)
});

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                identifier: { label: "Email or Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                const headersList = await headers();
                const ip = headersList.get("x-forwarded-for") || "127.0.0.1";
                const { success } = await ratelimit.limit(`login_${ip}`);

                if (!success) {
                    throw new Error("Too many login attempts. Please try again in a minute.");
                }

                const validation = loginSchema.safeParse(credentials);
                if (!validation.success) {
                    throw new Error("Invalid input format.");
                }

                const client = await clientPromise;
                const db = client.db("kanban_db");

                const user = await db.collection("users").findOne({
                    $or: [
                        { email: validation.data.identifier },
                        { username: validation.data.identifier }
                    ]
                });

                if (user) {
                    const isPasswordCorrect = await bcrypt.compare(
                        validation.data.password,
                        user.password as string
                    );

                    if (isPasswordCorrect) {
                        return {
                            id: user._id.toString(),
                            name: user.name as string,
                            email: user.email as string,
                            username: user.username as string,
                        };
                    }
                }
                throw new Error("Invalid credentials");
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.username = (user as { username?: string }).username;
                token.email = user.email;
                token.name = user.name;
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                // Only expose a nickname (first name) to the client — never email or internal IDs
                const firstName = (token.name as string)?.split(" ")[0] || "User";
                session.user = {
                    name: firstName,
                    id: crypto.createHash("sha256").update(token.email as string).digest("hex").slice(0, 12),
                    email: "", // Stripped — email stays in JWT only (server-side)
                };
            }
            return session;
        }
    },
    pages: {
        signIn: '/auth/signin',
    },
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Securely extract the user's email from the JWT token (server-side only).
 * This never exposes the email to the client — it reads directly from the encrypted JWT.
 */
export async function getServerEmail(req: NextRequest): Promise<string | null> {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    return (token?.email as string) || null;
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
