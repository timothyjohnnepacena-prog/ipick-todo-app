import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "@/lib/mongodb";
import bcrypt from "bcrypt";
import { z } from "zod";
import { ratelimit } from "@/lib/ratelimit";
import { headers } from "next/headers";

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1)
});

export const authOptions = {
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
            user.password
          );

          if (isPasswordCorrect) {
            return { 
              id: user._id.toString(), 
              name: user.name, 
              email: user.email, 
              username: user.username 
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
        token.username = user.username;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          name: token.name,
          email: token.email
        };
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };