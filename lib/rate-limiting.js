// lib/rate-limit.js (Basic implementation concept)
const rates = new Map();

export function rateLimit(ip) {
  const now = Date.now();
  const userRate = rates.get(ip) || { count: 0, last: now };
  
  if (now - userRate.last > 60000) {
    userRate.count = 0;
    userRate.last = now;
  }
  
  userRate.count++;
  rates.set(ip, userRate);
  
  return userRate.count <= 10; // Limit to 10 requests per minute
}