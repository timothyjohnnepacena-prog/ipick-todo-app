// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "@/lib/mongodb";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import bcrypt from "bcrypt";

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" }, 
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // SECURITY: Ensure identifier is a string to prevent NoSQL injection
        if (!credentials?.identifier || typeof credentials.identifier !== "string") return null;

        const client = await clientPromise;
        const db = client.db("kanban_db");

        // Search by email OR username
        const user = await db.collection("users").findOne({
          $or: [
            { email: credentials.identifier },
            { username: credentials.identifier }
          ]
        });

        if (user && user.password) {
          const isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);
          if (isPasswordCorrect) {
            return { 
              id: user._id.toString(), 
              name: user.name, 
              email: user.email, 
              username: user.username 
            };
          }
        }
        return null;
      }
    })
  ],
  session: {
    // FIX: Must use 'jwt' for CredentialsProvider to prevent login hang
    strategy: "jwt", 
    maxAge: 30 * 24 * 60 * 60, 
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { 
    signIn: '/auth/signin' 
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };