// lib/rate-limiting.js
const rates = new Map();

export function rateLimit(ip) {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 10;

  const userRate = rates.get(ip) || { count: 0, lastReset: now };

  // Reset count if the 1-minute window has passed
  if (now - userRate.lastReset > windowMs) {
    userRate.count = 0;
    userRate.lastReset = now;
  }

  userRate.count++;
  rates.set(ip, userRate);

  return userRate.count <= maxRequests;
}