import Redis from "ioredis";

let client: Redis | undefined;

export function redis() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
      retryStrategy(attempt) {
        return Math.min(attempt * 500, 5_000);
      },
    });

    // Redis is an auxiliary layer. Handling the event prevents ioredis from
    // emitting an unhandled error while its retry strategy reconnects.
    client.on("error", () => undefined);
  }

  return client;
}

export async function loginLimit(ip: string, username: string) {
  try {
    const connection = redis();
    if (connection.status === "wait") await connection.connect();

    const key = `login:${ip}:${username}`;
    const count = await connection.incr(key);
    if (count === 1) await connection.expire(key, 900);

    return {
      allowed: count <= 8,
      delayMs: count > 3 ? Math.min((count - 3) * 750, 5_000) : 0,
    };
  } catch {
    // A Redis outage must not take down the site or lock every administrator out.
    return { allowed: true, delayMs: 0 };
  }
}
