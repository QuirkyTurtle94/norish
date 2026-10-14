import type { Job } from "bullmq";

import type { StoreLookupJobData } from "@norish/queue/contracts/job-types";
import { clearPendingLink } from "@norish/db/repositories/store-products";
import { findIngredientFor } from "@norish/shared-server/ingredients/resolver";
import { createLogger } from "@norish/shared-server/logger";

import { QUEUE_NAMES } from "../config";
import { createWorker, isFinalFailure } from "../create-worker";
import { completeStep, reportStep } from "../job-steps";
import { matchGroceryName, refreshProducts } from "./lookup";

const log = createLogger("worker:store-lookup");

/**
 * The Ingredient a match job asks about. A job queued before questions named
 * their Ingredient carries only the grocery's name, whose Ingredient the
 * upgrade has since resolved (ADR-0037); it is looked up by that name.
 */
async function ingredientAskedAbout(
  data: Extract<StoreLookupJobData, { kind: "match" }>
): Promise<string | null> {
  if (data.ingredientId) return data.ingredientId;

  return (await findIngredientFor(data.name))?.ingredientId ?? null;
}

async function processStoreLookup(job: Job<StoreLookupJobData>): Promise<void> {
  if (job.data.kind === "match") {
    const { storeId, name, householdKey } = job.data;
    const ingredientId = await ingredientAskedAbout(job.data);

    // A name Norish no longer knows has nothing to be filed under; the next
    // view of the list asks again.
    if (!ingredientId) return;

    await matchGroceryName({
      storeId,
      ingredientId,
      name,
      householdKey,
      onStep: (step) => reportStep(job, step),
      onStepDone: (detail) => completeStep(job, detail),
    });

    return;
  }

  await reportStep(job, "reading-product", { asked: job.data.productIds.length });
  const { refreshed } = await refreshProducts({
    productIds: job.data.productIds,
    householdKey: job.data.householdKey,
  });

  await completeStep(job, { refreshed });
  log.debug({ jobId: job.id, refreshed }, "Refreshed stale Shelf Prices");
}

/**
 * A lookup that gave up. A match job that has spent its attempts, or was
 * cancelled, leaves no Pending Link behind: the name is unknown again, and
 * the next view of the list asks. An attempt that will be retried leaves the
 * row where it is — the question is still being asked.
 */
export async function forgetFailedLookup(
  job: Pick<Job<StoreLookupJobData>, "data" | "attemptsMade" | "opts"> | undefined,
  error: Error
): Promise<void> {
  if (job?.data.kind !== "match") return;
  if (!isFinalFailure(job, error)) return;
  const ingredientId = await ingredientAskedAbout(job.data);

  if (ingredientId) await clearPendingLink(job.data.storeId, ingredientId);
}

export function startStoreLookupWorker(): void {
  createWorker(QUEUE_NAMES.STORE_LOOKUP, processStoreLookup, { onFailed: forgetFailedLookup });
}
