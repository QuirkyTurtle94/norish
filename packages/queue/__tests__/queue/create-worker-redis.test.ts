// @vitest-environment node
/**
 * A worker started through `createWorker`, against a real Redis reached
 * through the production connection options: a producer adds a job, and the
 * test watches what becomes of it.
 */
import type { StartedRedisContainer } from "@testcontainers/redis";
import { RedisContainer } from "@testcontainers/redis";
import { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";

import { recordModelUse } from "@norish/shared-server/ai/runtime/model-use-ledger";
import {
  getCurrentOperationId,
  runWithOperationContext,
} from "@norish/shared-server/lib/operation-context";

import { freezableProxy, REDIS_IMAGE } from "../../../shared-server/__tests__/helpers/redis";
import { closeWorkers, createWorker } from "../../src/create-worker";
import { readStepProgress } from "../../src/job-steps";
import { QUEUE_NAMES } from "../../src/queue-names";
import { withJobOperationContext } from "../../src/queue-operation-context";
import { closeBullConnection, getBullClient } from "../../src/redis/bullmq";

const config = vi.hoisted(() => ({ url: "" }));
const logged = vi.hoisted(() => vi.fn());

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get REDIS_URL() {
      return config.url;
    },
  },
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: logged,
  }),
}));

const QUEUE = QUEUE_NAMES.RECIPE_IMPORT;

let container: StartedRedisContainer;
let proxy: ReturnType<typeof freezableProxy>;
let queue: Queue;

beforeAll(async () => {
  container = await new RedisContainer(REDIS_IMAGE).start();
  proxy = freezableProxy({ host: container.getHost(), port: container.getPort() });
  config.url = await proxy.listen();
  queue = new Queue(QUEUE, { connection: getBullClient() });
  // The outage below reaches the producer too; only the worker's error is under test.
  queue.on("error", () => {});
});

afterEach(async () => {
  await closeWorkers(0);
  await queue.obliterate({ force: true });
});

afterAll(async () => {
  await queue?.close();
  await closeBullConnection();
  await proxy?.close();
  await container?.stop();
});

it("runs a retry when its backoff ends, with no other job added", async () => {
  const attempts: number[] = [];

  createWorker(QUEUE, async (job) => {
    attempts.push(job.attemptsMade);
    if (job.attemptsMade === 0) throw new Error("transient");
  });

  const job = await queue.add(
    "import",
    {},
    { attempts: 2, backoff: { type: "fixed", delay: 1_000 } }
  );

  await expect.poll(() => queue.getJobState(job.id!), { timeout: 10_000 }).toBe("completed");
  expect(attempts).toEqual([0, 1]);
}, 30_000);

it("hands the processor an abort signal, inside the job's operation context and a model ledger", async () => {
  let seen: { signal: unknown; operationId: string | undefined } | undefined;

  createWorker(QUEUE, async (_job, _token, signal) => {
    seen = { signal, operationId: getCurrentOperationId() };
    recordModelUse({ provider: "openai", model: "gpt-5", outcome: "completed" });
  });

  const job = await runWithOperationContext({ operationId: "op-1" as never }, () =>
    queue.add("import", withJobOperationContext({}))
  );

  await expect.poll(() => queue.getJobState(job.id!), { timeout: 10_000 }).toBe("completed");
  expect(seen?.signal).toBeInstanceOf(AbortSignal);
  expect(seen?.operationId).toBe("op-1");

  const stored = await queue.getJob(job.id!);

  expect(readStepProgress(stored?.progress)?.attempts[0]?.models).toEqual([
    { provider: "openai", model: "gpt-5", outcome: "completed" },
  ]);
}, 30_000);

it("logs a worker error through the logger", async () => {
  createWorker(QUEUE, async () => {});
  await expect.poll(() => logged.mock.calls.length).toBe(0);

  // An outage: every connection drops and new ones are refused.
  await proxy.close();

  try {
    await expect
      .poll(() => logged.mock.calls.some(([, message]) => message === "Worker error"), {
        timeout: 10_000,
      })
      .toBe(true);
  } finally {
    await proxy.listen();
  }
}, 30_000);

it("lets a running job finish within the budget before closing its worker", async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));

  createWorker(QUEUE, async () => {
    started();
    await held;

    return "done";
  });

  const job = await queue.add("held", {});

  await running;

  let closed = false;
  const closing = closeWorkers(10_000).then(() => (closed = true));

  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(closed).toBe(false);

  release();
  await closing;
  expect((await queue.getJob(job.id!))?.returnvalue).toBe("done");
}, 30_000);

it("closes by force once the budget runs out, leaving the job active", async () => {
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));

  createWorker(QUEUE, async () => {
    started();
    await new Promise(() => {});
  });

  const job = await queue.add("stuck", {});

  await running;

  const startedAt = Date.now();

  await closeWorkers(500);

  expect(Date.now() - startedAt).toBeLessThan(2_000);
  expect(await queue.getJobState(job.id!)).toBe("active");
}, 30_000);
