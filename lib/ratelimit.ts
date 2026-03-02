import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Upstash Redis variables are available to prevent startup crashes on Vercel
const hasRedisEnv = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = hasRedisEnv ? Redis.fromEnv() : null;

// Mock Ratelimit if Redis is not configured (e.g., in Vercel without env vars)
function createRateLimit(limit: number, window: `${number} ${"s" | "m" | "h" | "d"}`) {
    if (redis) {
        return new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(limit, window),
            analytics: true,
        });
    }

    // Return a dummy limiter that always succeeds if redis is missing
    return {
        limit: async () => ({ success: true }),
    } as unknown as Ratelimit;
}

// Strict rate limit for auth endpoints (login, register, password reset)
// 5 requests per minute — prevents brute-force attacks
export const authRatelimit = createRateLimit(5, "1 m");

// Relaxed rate limit for CRUD endpoints (todos, profile)
// 60 requests per minute — allows normal interactive use
export const apiRatelimit = createRateLimit(60, "1 m");

// Default export for backward compatibility with auth routes
export const ratelimit = authRatelimit;
