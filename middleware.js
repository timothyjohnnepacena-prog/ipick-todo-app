// middleware.js
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Protect all dashboard pages and API routes EXCEPT auth and static assets
export const config = { 
  matcher: [
    "/((?!api/auth|auth|register|_next/static|_next/image|favicon.ico|public).*)",
  ] 
};