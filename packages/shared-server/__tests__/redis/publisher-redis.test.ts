// @vitest-environment node
/**
 * The publisher through a real Redis outage: callers keep getting the one
 * client while it reconnects, a command sent meanwhile fails instead of
 * waiting for Redis to come back, and no extra connection is left behind.
 */
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { promisify } from "node:util";
import type { StartedRedisContainer } from "@testcontainers/redis";
import type { AddressInfo } from "node:net";
import { RedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import {
  closeRedisConnections,
  getPublisherClient,
  getRedisConnectionOptions,
} from "../../src/redis/client";
import { REDIS_IMAGE } from "../helpers/redis";

const config = vi.hoisted(() => ({ url: "" }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get REDIS_URL() {
      return config.url;
    },
  },
}));

const docker = promisify(execFile);
let container: StartedRedisContainer;

/** A fixed host port, so the container is reachable at the same URL after a restart. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address() as AddressInfo;

      server.close(() => resolve(port));
    });

    server.on("error", reject);
  });
}

beforeAll(async () => {
  container = await new RedisContainer(REDIS_IMAGE)
    .withExposedPorts({ container: 6379, host: await freePort() })
    .start();
  config.url = container.getConnectionUrl();
});

afterAll(async () => {
  await closeRedisConnections();
  await container?.stop();
});

it("keeps one publisher through an outage, and fails its commands meanwhile", async () => {
  const publisher = await getPublisherClient();

  await publisher.ping();
  await docker("docker", ["stop", "-t", "1", container.getId()]);
  await expect.poll(() => publisher.status).not.toBe("ready");

  const during = await Promise.all([getPublisherClient(), getPublisherClient()]);

  expect(during[0]).toBe(publisher);
  expect(during[1]).toBe(publisher);
  await expect(publisher.get("anything")).rejects.toThrow();

  await docker("docker", ["start", container.getId()]);
  await expect.poll(() => publisher.status, { timeout: 20_000 }).toBe("ready");

  const admin = new Redis(getRedisConnectionOptions(config.url));

  try {
    const ownId = await admin.client("ID");
    const clients = String(await admin.client("LIST"))
      .trim()
      .split("\n")
      .filter((line) => !line.startsWith(`id=${ownId} `));

    expect(clients).toHaveLength(1);
  } finally {
    admin.disconnect();
  }
}, 60_000);
