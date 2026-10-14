import type { Worker } from "bullmq";

import { hasRunningJob } from "./instrumented-processor";

/**
 * Close a worker, letting a running job finish. A worker with no job running
 * is closed by force: BullMQ's own close waits for whatever command its run
 * loop has in flight, which after a Redis restart can sit on a half-open
 * socket until the socket timeout.
 */
export async function closeWorker(worker: Worker): Promise<void> {
  await worker.close(!hasRunningJob(worker.name));
}
