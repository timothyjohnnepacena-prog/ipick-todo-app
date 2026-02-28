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

// Protect all routes EXCEPT specific authentication and static asset paths
export const config = { 
  matcher: [
    "/((?!api/auth|auth|register|_next/static|_next/image|favicon.ico|public/).*)",
  ] 
};