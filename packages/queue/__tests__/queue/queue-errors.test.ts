/**
 * A Queue with no `error` listener has BullMQ print the error with
 * console.error, past Norish's logger. Every factory attaches one.
 */
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOperationAwareQueue } from "../../src/operation-aware-queue";
import { createScheduledTasksQueue } from "../../src/scheduled-tasks/queue";
import { createStoreLookupQueue } from "../../src/store-lookup/queue";

const logged = vi.hoisted(() => vi.fn());

vi.mock("bullmq", async (importOriginal) => ({
  ...(await importOriginal<typeof import("bullmq")>()),
  Queue: class extends EventEmitter {
    constructor(readonly name: string) {
      super();
    }
  },
}));

vi.mock("@norish/queue/redis/bullmq", () => ({ getBullClient: vi.fn() }));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: logged,
  }),
}));

beforeEach(() => {
  logged.mockReset();
});

describe("a Queue's error", () => {
  it.each([
    ["an operation-aware queue", () => createOperationAwareQueue("recipe-import")],
    ["the scheduled tasks queue", () => createScheduledTasksQueue()],
    ["the store lookup queue", () => createStoreLookupQueue()],
  ])("reaches the logger from %s", (_label, create) => {
    const queue = create();
    const err = new Error("Connection is closed.");

    queue.emit("error", err);

    expect(logged).toHaveBeenCalledExactlyOnceWith({ err, queueName: queue.name }, "Queue error");
  });
});
