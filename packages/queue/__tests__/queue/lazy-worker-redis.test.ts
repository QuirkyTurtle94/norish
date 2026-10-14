// @vitest-environment node
/**
 * A lazy worker against a real Redis (ticket 24). BullMQ's `Worker.run()`
 * settles only when the worker closes, so the manager must not wait on it: a
 * server booting with a job already in a lazy queue registers that queue's
 * worker before it listens, and waiting on `run()` there held the boot forever.
 */
import type { StartedRedisContainer } from "@testcontainers/redis";
import type { Job } from "bullmq";
import { RedisContainer } from "@testcontainers/redis";
import { Queue } from "bullmq";
import { afterAll, beforeAll, expect, it } from "vitest";

import { REDIS_IMAGE } from "../../../shared-server/__tests__/helpers/redis";
import { createLazyWorker, stopLazyWorker } from "../../src/lazy-worker-manager";
import { getBullConnectionOptions } from "../../src/redis/bullmq";

const QUEUE = "lazy-worker-redis-test";

let redis: StartedRedisContainer;
/** Lets the held job finish, so closing the worker does not wait on it. */
let finish = () => {};

beforeAll(async () => {
  redis = await new RedisContainer(REDIS_IMAGE).start();
});

afterAll(async () => {
  finish();
  await stopLazyWorker(QUEUE);
  await redis?.stop();
});

/** The manager's own record of the worker, which the idle timers read. */
function isRunning(): boolean | undefined {
  const registry = (globalThis as { lazyWorkerRegistry?: Map<string, { isRunning: boolean }> })
    .lazyWorkerRegistry;

  return registry?.get(QUEUE)?.isRunning;
}

it("registers with a job already waiting, runs it, and counts as running meanwhile", async () => {
  const connection = getBullConnectionOptions(redis.getConnectionUrl());
  const queue = new Queue(QUEUE, { connection });
  const finished = new Promise<void>((resolve) => (finish = resolve));
  let started!: (data: unknown) => void;
  const picked = new Promise<unknown>((resolve) => (started = resolve));

  await queue.add("waiting-at-boot", { n: 1 });

  // The job holds the worker busy until the test lets it go, as a long import does.
  await createLazyWorker(
    QUEUE,
    async (job: Job<{ n: number }>) => {
      started(job.data);
      await finished;
    },
    { connection }
  );

  await expect(picked).resolves.toEqual({ n: 1 });
  expect(isRunning()).toBe(true);
  finish();
  await queue.close();
}, 20_000);
