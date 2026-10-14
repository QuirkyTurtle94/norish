// @vitest-environment node
/**
 * Shutdown after a Redis restart left the connections half-open: an idle
 * worker, the queue and the shared BullMQ client close at once, instead of
 * waiting on its run loop's command or a QUIT the dead socket never answers.
 */
import type { StartedRedisContainer } from "@testcontainers/redis";
import { RedisContainer } from "@testcontainers/redis";
import { Queue, Worker } from "bullmq";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { freezableProxy, REDIS_IMAGE } from "../../../shared-server/__tests__/helpers/redis";
import { closeWorker } from "../../src/close-worker";
import { baseWorkerOptions } from "../../src/config";
import { instrumentProcessor } from "../../src/instrumented-processor";
import { closeBullConnection, getBullClient } from "../../src/redis/bullmq";

const config = vi.hoisted(() => ({ url: "" }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get REDIS_URL() {
      return config.url;
    },
  },
}));

let container: StartedRedisContainer;
let proxy: ReturnType<typeof freezableProxy>;

beforeAll(async () => {
  container = await new RedisContainer(REDIS_IMAGE).start();
  proxy = freezableProxy({ host: container.getHost(), port: container.getPort() });
  config.url = await proxy.listen();
});

afterAll(async () => {
  await proxy?.close();
  await container?.stop();
});

it("closes every BullMQ connection at once when the sockets have gone half-open", async () => {
  const queue = new Queue("bullmq-redis-test", { connection: getBullClient() });
  const worker = new Worker("bullmq-redis-test", async () => {}, {
    ...baseWorkerOptions,
    connection: getBullClient(),
  });

  queue.on("error", () => {});
  worker.on("error", () => {});
  await Promise.all([queue.waitUntilReady(), worker.waitUntilReady()]);
  // The worker's run loop has a command in flight when the socket goes dead.
  proxy.freeze();

  const startedAt = Date.now();

  await closeWorker(worker);
  await queue.close();
  await closeBullConnection();

  expect(Date.now() - startedAt).toBeLessThan(1_000);
}, 30_000);

it("lets a running job finish before closing its worker", async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));
  const queue = new Queue("bullmq-redis-running", { connection: getBullClient() });
  const worker = new Worker(
    "bullmq-redis-running",
    instrumentProcessor(async () => {
      started();
      await held;

      return "done";
    }),
    { ...baseWorkerOptions, connection: getBullClient() }
  );

  await queue.add("held", {});
  await running;

  let closed = false;
  const closing = closeWorker(worker).then(() => (closed = true));

  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(closed).toBe(false);

  release();
  await closing;

  const [job] = await queue.getJobs(["completed"]);

  expect(job?.returnvalue).toBe("done");
  await queue.close();
  await closeBullConnection();
}, 30_000);
