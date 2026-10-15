/**
 * CalDAV Sync Producer - Application Logic
 *
 * Enqueue logic for CalDAV sync jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import { randomUUID } from "node:crypto";
import type { Queue } from "bullmq";

import type { CaldavSyncJobData } from "@norish/queue/contracts/job-types";
import { createLogger } from "@norish/shared-server/logger";

import { sanitizeUrlForJobId } from "../helpers";

const log = createLogger("queue:caldav-sync");

/**
 * How long a sync waits for further edits to the same item. BullMQ replaces a
 * deduplicated job only while it is delayed, so the delay is what turns a
 * burst of edits into one sync.
 */
export const CALDAV_SYNC_DEBOUNCE_MS = 2_000;

/**
 * One deduplication id per (calendar, item), so edits to one planned item
 * collapse into a single sync.
 */
function caldavDeduplicationId(caldavServerUrl: string, itemId: string): string {
  const sanitizedUrl = sanitizeUrlForJobId(caldavServerUrl);

  return `caldav_${sanitizedUrl}_${itemId}`;
}

/**
 * Whether a sync of this item is delayed, waiting or running. BullMQ drops the
 * deduplication id when the job finishes, after the worker has written the
 * item's sync row.
 */
export async function isCaldavSyncPending(
  queue: Queue<CaldavSyncJobData>,
  caldavServerUrl: string,
  itemId: string
): Promise<boolean> {
  return (
    (await queue.getDeduplicationJobId(caldavDeduplicationId(caldavServerUrl, itemId))) !== null
  );
}

/**
 * Add a CalDAV sync job to the queue. A sync still waiting out its delay is
 * replaced by the newer state; one running gets exactly one follow-up, with
 * the last state added while it ran.
 */
export async function addCaldavSyncJob(
  queue: Queue<CaldavSyncJobData>,
  data: CaldavSyncJobData
): Promise<void> {
  const jobId = randomUUID();
  const job = await queue.add("sync", data, {
    jobId,
    delay: CALDAV_SYNC_DEBOUNCE_MS,
    deduplication: {
      id: caldavDeduplicationId(data.caldavServerUrl, data.itemId),
      replace: true,
      keepLastIfActive: true,
    },
  });

  if (job.id && job.id !== jobId) {
    // Deduplicated onto a job past its delay. A running one keeps this state
    // for its follow-up; one waiting for the worker would sync the older
    // state, so it is handed this one.
    // ponytail: not atomic with the add; a job the worker takes in between
    // syncs the older state. A Lua script would close it if it ever matters.
    await (await queue.getJob(job.id))?.updateData(data);
    log.debug({ jobId: job.id, itemId: data.itemId }, "CalDAV sync merged into a queued one");

    return;
  }

  log.info(
    { jobId, itemId: data.itemId, operation: data.operation },
    "CalDAV sync job added to queue"
  );
}
