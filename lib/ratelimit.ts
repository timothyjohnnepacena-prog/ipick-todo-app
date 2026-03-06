import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasRedisEnv = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = hasRedisEnv ? Redis.fromEnv() : null;

function createRateLimit(limit: number, window: `${number} ${"s" | "m" | "h" | "d"}`) {
    if (redis) {
        return new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(limit, window),
            analytics: true,
        });
    }

    return {
        limit: async () => ({ success: true }),
    } as unknown as Ratelimit;
}

export const authRatelimit = createRateLimit(5, "1 m");

export const apiRatelimit = createRateLimit(60, "1 m");

export const ratelimit = authRatelimit;
