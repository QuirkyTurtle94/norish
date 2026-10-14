/**
 * BullMQ Redis Connection Management
 *
 * Provides a shared Redis connection for BullMQ producers (Queue.add).
 *
 * IMPORTANT: When passed to Workers, BullMQ internally duplicates this
 * connection to create separate blocking (for job polling) and non-blocking
 * (for commands) connections. Workers don't share a single socket - they
 * share connection OPTIONS via this template connection.
 */

import type { RedisOptions } from "ioredis";
import Redis from "ioredis";

import { createLogger } from "@norish/shared-server/logger";
import { getRedisConnectionOptions } from "@norish/shared-server/redis/client";

const log = createLogger("redis:bullmq");

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in ../registry.ts for why this module is evaluated more
// than once per process. Here the cost of getting it wrong is one "shared"
// Redis connection per instance.
const globalForBull = globalThis as unknown as {
  bullClient: Redis | null;
};

/**
 * The shared Redis options plus what BullMQ needs on top: it connects at once,
 * a command waits out an outage in the offline queue instead of failing, and
 * no ready check holds the connection back.
 */
export function getBullConnectionOptions(url?: string): RedisOptions {
  return {
    ...getRedisConnectionOptions(url),
    lazyConnect: false,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
  };
}

/**
 * Get the shared BullMQ Redis connection (singleton).
 *
 * For Queues (producers): This connection is reused directly.
 * For Workers: BullMQ duplicates this connection internally to create
 * separate blocking/non-blocking connections. The connection passed
 * serves as a template for connection options.
 */
export function getBullClient(): Redis {
  const existing = globalForBull.bullClient;

  // Check if existing client is still usable
  if (existing && existing.status !== "end" && existing.status !== "close") {
    return existing;
  }

  // Clean up old client listeners before creating new one
  if (existing) {
    existing.removeAllListeners();
  }

  // Create new client if none exists or previous one was closed
  const bullClient = new Redis({
    ...getBullConnectionOptions(),
    connectionName: `norish:${process.pid}:bull`,
  });

  bullClient.on("error", (err) => {
    log.error({ err }, "BullMQ Redis error");
  });

  bullClient.on("connect", () => {
    log.debug("BullMQ Redis connected");
  });

  bullClient.on("close", () => {
    log.debug("BullMQ Redis closed");
  });

  globalForBull.bullClient = bullClient;

  return bullClient;
}

/**
 * Close the BullMQ Redis connection.
 * Call during server shutdown.
 */
export async function closeBullConnection(): Promise<void> {
  const bullClient = globalForBull.bullClient;

  if (bullClient && bullClient.status !== "end") {
    await bullClient.quit();
    globalForBull.bullClient = null;
    log.info("BullMQ Redis connection closed");
  }
}
