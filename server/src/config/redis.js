import Redis from "ioredis";

let redis = null;

export const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.log("Redis not configured. Skipping Redis.");
    return null;
  }

  const client = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    retryStrategy: () => null,
  });

  client.on("error", (error) => {
    console.error("Redis error:", error.message);
  });

  try {
    await client.connect();

    redis = client;

    console.log("Redis connected successfully");

    return redis;
  } catch (error) {
    console.log("Redis unavailable. Continuing without Redis.");

    client.disconnect();

    redis = null;

    return null;
  }
};

export const getRedis = () => redis;