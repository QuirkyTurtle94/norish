/**
 * What every worker's processor runs inside, lazy or always-on: the operation
 * context the job was enqueued under, so the events it emits carry it, and a
 * model-use ledger the AI Runtime records into, written onto the job's attempt
 * when the processor settles. One composition for every worker, because the
 * ledger was once wired into the lazy worker manager alone, and the store
 * lookup — always-on, built by hand — asked its Decision Model with nothing in
 * the job monitor to show for it. It also counts the jobs running per queue,
 * which closing a worker reads.
 */

import type { Processor } from "bullmq";

import { createModelLedgerProcessor } from "./model-ledger-processor";
import { createContextAwareProcessor } from "./queue-operation-context";

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in ./registry.ts for why this module is evaluated more
// than once per process.
const globalForRunning = globalThis as unknown as {
  runningJobs: Map<string, number> | undefined;
};

function runningJobs(): Map<string, number> {
  return (globalForRunning.runningJobs ??= new Map());
}

/** Whether a job of this queue is running in this process right now. */
export function hasRunningJob(queueName: string): boolean {
  return (runningJobs().get(queueName) ?? 0) > 0;
}

export function instrumentProcessor<T>(processor: Processor<T>): Processor<T> {
  const instrumented = createContextAwareProcessor(createModelLedgerProcessor(processor));

  return async (job, token, signal) => {
    const running = runningJobs();

    running.set(job.queueName, (running.get(job.queueName) ?? 0) + 1);

    try {
      return await instrumented(job, token, signal);
    } finally {
      running.set(job.queueName, (running.get(job.queueName) ?? 1) - 1);
    }
  };
}
