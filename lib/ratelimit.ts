import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Strict rate limit for auth endpoints (login, register, password reset)
// 5 requests per minute — prevents brute-force attacks
export const authRatelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(1, "1 m"),
    analytics: true,
});

// Relaxed rate limit for CRUD endpoints (todos, profile)
// 60 requests per minute — allows normal interactive use
export const apiRatelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    analytics: true,
});

// Default export for backward compatibility with auth routes
export const ratelimit = authRatelimit;
