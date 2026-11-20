import Redis from "ioredis";

let redis;

export const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.log("Redis URL not configured. Skipping Redis.");
    return null;
  }

  redis = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  redis.on("connect", () => {
    console.log("Redis connected successfully");
  });

  redis.on("error", (error) => {
    console.error("Redis error:", error.message);
  });

  try {
    await redis.connect();
    return redis;
  } catch (error) {
    console.error("Redis connection failed:", error.message);
    redis.disconnect();
    redis = null;
    return null;
  }
};

export const getRedis = () => redis;