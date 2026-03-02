import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl;
    const response = NextResponse.next();

    if (pathname.startsWith("/api/")) {
        // ─── Security Headers for ALL API responses ───
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("X-Frame-Options", "DENY");

        const secFetchSite = request.headers.get("sec-fetch-site");
        const secFetchMode = request.headers.get("sec-fetch-mode");

        // ─── NextAuth routes — let NextAuth handle them, but add security headers ───
        const isNextAuthRoute = pathname.startsWith("/api/auth/");
        if (isNextAuthRoute) {
            // Block direct browser navigation to the session endpoint
            if (pathname === "/api/auth/session") {
                if (secFetchMode === "navigate" || secFetchSite === "none") {
                    return NextResponse.json(
                        { error: "Forbidden" },
                        { status: 403, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
                    );
                }
            }
            return response;
        }

        // ─── CSRF Protection: block cross-origin requests ───
        if (secFetchSite && secFetchSite !== "same-origin") {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403, headers: { "Cache-Control": "no-store" } }
            );
        }

        // ─── Content-Type enforcement for mutating requests ───
        const method = request.method.toUpperCase();
        if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
            const contentType = request.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                return NextResponse.json(
                    { error: "Invalid content type" },
                    { status: 415, headers: { "Cache-Control": "no-store" } }
                );
            }
        }
    }

    return response;
}

export const config = {
    matcher: ["/api/:path*"],
};
