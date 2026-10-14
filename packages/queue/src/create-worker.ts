/**
 * The one way a worker starts. Every queue has an always-on worker from boot,
 * so a retry waiting out its backoff runs when the backoff ends, and a retry
 * pending across a restart runs after it.
 *
 * A worker started here:
 * - runs its processor inside the operation context the job was enqueued
 *   under and a model-use ledger the AI Runtime records into, so no worker
 *   can miss the job monitor's AI-model chip
 * - logs its errors and failed jobs through the server logger
 * - is registered for shutdown
 * - passes its processor BullMQ's abort signal as a third parameter, which
 *   BullMQ only creates for a processor that declares three parameters
 */

import type { Job, Processor } from "bullmq";
import { Worker } from "bullmq";

import { createLogger } from "@norish/shared-server/logger";

import type { QueueName } from "./queue-names";
import { baseWorkerOptions, STALLED_INTERVAL, WORKER_CONCURRENCY } from "./config";
import { createModelLedgerProcessor } from "./model-ledger-processor";
import { createContextAwareProcessor } from "./queue-operation-context";
import { getBullClient } from "./redis/bullmq";

const log = createLogger("worker");

interface StartedWorker {
  worker: Worker;
  /** The jobs this worker is running right now, settled or not. */
  running: Set<Promise<unknown>>;
}

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in ./registry.ts for why this module is evaluated more
// than once per process. Here the cost of getting it wrong is a rival worker
// that shutdown cannot reach.
const globalForWorkers = globalThis as unknown as {
  workers: Map<QueueName, StartedWorker> | undefined;
};

function workers(): Map<QueueName, StartedWorker> {
  return (globalForWorkers.workers ??= new Map());
}

export interface CreateWorkerOptions<T> {
  /** The queue's own failure policy, run after every failed attempt. */
  onFailed?: (job: Job<T> | undefined, error: Error) => void | Promise<void>;
}

export function createWorker<T>(
  queueName: QueueName,
  processor: Processor<T>,
  options: CreateWorkerOptions<T> = {}
): Worker<T> {
  if (workers().has(queueName)) {
    throw new Error(`A worker for ${queueName} has already started`);
  }

  const running = new Set<Promise<unknown>>();
  const instrumented = createContextAwareProcessor(createModelLedgerProcessor(processor));
  const worker = new Worker<T>(
    queueName,
    // Three parameters, or BullMQ creates no abort signal.
    async (job, token, signal) => {
      const run = instrumented(job, token, signal);

      running.add(run);

      try {
        return await run;
      } finally {
        running.delete(run);
      }
    },
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[queueName],
      concurrency: WORKER_CONCURRENCY[queueName],
    }
  );

  worker.on("error", (err) => {
    log.error({ err, queueName }, "Worker error");
  });

  worker.on("failed", (job, err) => {
    log.error({ err, queueName, jobId: job?.id }, "Job failed");
    if (!options.onFailed) return;
    Promise.resolve()
      .then(() => options.onFailed?.(job, err))
      .catch((handlerErr: unknown) => {
        log.error({ err: handlerErr, queueName, jobId: job?.id }, "Failure handler threw");
      });
  });

  workers().set(queueName, { worker: worker as Worker, running });

  return worker;
}

/**
 * Close every worker. Each stops taking jobs at once, and a running job gets
 * until the budget runs out to finish; then the workers are closed by force,
 * and a job still running stays active for the next boot's stalled-job check.
 * Always by force in the end: BullMQ's graceful close also waits for whatever
 * command its run loop has in flight, which after a Redis restart can sit on a
 * half-open socket until the socket timeout.
 */
export async function closeWorkers(budgetMs: number): Promise<void> {
  const started = [...workers().values()];

  workers().clear();
  await Promise.all(started.map(({ worker }) => worker.pause(true)));

  let timer: NodeJS.Timeout | undefined;
  const budget = new Promise<void>((resolve) => (timer = setTimeout(resolve, budgetMs)));
  const finished = Promise.allSettled(started.flatMap(({ running }) => [...running]));

  await Promise.race([finished, budget]);
  clearTimeout(timer);
  await Promise.all(started.map(({ worker }) => worker.close(true)));
}
