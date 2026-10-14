/**
 * Queue Registry
 *
 * Centralized lifecycle management for all BullMQ queues.
 * Queues are created once at server startup and closed on shutdown.
 *
 * This module is the single source of truth for queue instances.
 * Consumers should import queues from here, not create their own.
 */

import type { DefaultJobOptions, Queue, QueueOptions } from "bullmq";
import { Queue as BullQueue } from "bullmq";

import type { JobRetentionConfig } from "@norish/config/zod/server-config";
import type {
  CaldavSyncJobData,
  ImageImportJobData,
  IngredientIconsJobData,
  IngredientReviewJobData,
  NewIngredientsJobData,
  PasteImportJobData,
  RecipeEnrichmentJobData,
  RecipeImportJobData,
  StoreLookupJobData,
} from "@norish/queue/contracts/job-types";
import { DEFAULT_JOB_RETENTION, ServerConfigKeys } from "@norish/config/zod/server-config";
import { getConfig } from "@norish/db/repositories/server-config";
import { createLogger } from "@norish/shared-server/logger";

import type { QueueName, QueueRemovalOptions } from "./config";
import type { ScheduledTaskJobData } from "./scheduled-tasks/queue";
import {
  allergyDetectionJobOptions,
  autoCategorizationJobOptions,
  autoTaggingJobOptions,
  buildRemovalOptions,
  caldavSyncJobOptions,
  imageGenerationJobOptions,
  imageImportJobOptions,
  ingredientIconsJobOptions,
  ingredientLinkingJobOptions,
  ingredientReviewJobOptions,
  newIngredientsJobOptions,
  nutritionEstimationJobOptions,
  pasteImportJobOptions,
  QUEUE_NAMES,
  recipeImportJobOptions,
  recipeProvenanceJobOptions,
  scheduledTasksJobOptions,
  storeLookupJobOptions,
} from "./config";
import { createOperationAwareQueue, logQueueErrors } from "./operation-aware-queue";
import { getBullClient } from "./redis/bullmq";

const log = createLogger("queue:registry");

/**
 * Registry state - holds all active queue instances.
 *
 * Lives on globalThis and is read on every access rather than copied into a
 * module-local, because this module is genuinely evaluated more than once per
 * process. Development resolves `@norish/queue/registry` through the app's path
 * alias into the source tree from one import chain and through the node_modules
 * copy from another; HMR does the same over time. A module-local captured at
 * load time stays null in whichever instance loaded before initialization, and
 * that instance then reports "not initialized" while the queues are running.
 */
const globalForRegistry = globalThis as unknown as {
  queueRegistry: QueueRegistry | null;
  queueRegistryInitializing: Promise<QueueRegistry> | null;
};

interface QueueRegistry {
  recipeImport: Queue<RecipeImportJobData>;
  imageImport: Queue<ImageImportJobData>;
  pasteImport: Queue<PasteImportJobData>;
  nutritionEstimation: Queue<RecipeEnrichmentJobData>;
  autoTagging: Queue<RecipeEnrichmentJobData>;
  autoCategorization: Queue<RecipeEnrichmentJobData>;
  allergyDetection: Queue<RecipeEnrichmentJobData>;
  recipeProvenance: Queue<RecipeEnrichmentJobData>;
  ingredientLinking: Queue<RecipeEnrichmentJobData>;
  imageGeneration: Queue<RecipeEnrichmentJobData>;
  caldavSync: Queue<CaldavSyncJobData>;
  scheduledTasks: Queue<ScheduledTaskJobData>;
  storeLookup: Queue<StoreLookupJobData>;
  ingredientReview: Queue<IngredientReviewJobData>;
  ingredientIcons: Queue<IngredientIconsJobData>;
  newIngredients: Queue<NewIngredientsJobData>;
}

/**
 * How many entries a queue's events stream keeps. Every progress write copies
 * the job's whole step timeline into it, BullMQ keeps 10,000 by default, and
 * nothing reads its history: the job monitor reads job state.
 */
export const EVENTS_MAX_LEN = 1_000;

/**
 * What every queue is built with: the shared connection, the queue's job
 * defaults under the administrator's retention, and the capped events stream.
 * A Queue built with other options would rewrite the cap in the queue's
 * metadata, which is why no module builds one but this.
 */
function queueOptions(jobOptions: DefaultJobOptions, removal: QueueRemovalOptions): QueueOptions {
  return {
    connection: getBullClient(),
    defaultJobOptions: { ...jobOptions, ...removal },
    streams: { events: { maxLen: EVENTS_MAX_LEN } },
  };
}

/** A queue whose jobs carry the operation context they were enqueued under. */
function operationAwareQueue<T extends object>(
  name: QueueName,
  jobOptions: DefaultJobOptions,
  removal: QueueRemovalOptions
): Queue<T> {
  return createOperationAwareQueue<T>(name, queueOptions(jobOptions, removal));
}

function plainQueue<T>(
  name: QueueName,
  jobOptions: DefaultJobOptions,
  removal: QueueRemovalOptions
): Queue<T> {
  return logQueueErrors(new BullQueue<T>(name, queueOptions(jobOptions, removal)));
}

/**
 * Completed image imports carry their images as base64, so they are kept an
 * hour at most, whatever the retention says, to bound Redis memory.
 */
function capImageImportAge(removal: QueueRemovalOptions): QueueRemovalOptions {
  const { removeOnComplete } = removal;

  if (typeof removeOnComplete !== "object" || !("age" in removeOnComplete)) return removal;

  return {
    ...removal,
    removeOnComplete: { ...removeOnComplete, age: Math.min(3600, removeOnComplete.age) },
  };
}

async function loadJobRetention(): Promise<JobRetentionConfig> {
  try {
    const retention = await getConfig<JobRetentionConfig>(ServerConfigKeys.JOB_RETENTION);

    return retention ?? DEFAULT_JOB_RETENTION;
  } catch (err) {
    log.warn({ err }, "Failed to load job retention config, using defaults");

    return DEFAULT_JOB_RETENTION;
  }
}

/**
 * Initialize all queues. Call once at server startup.
 * Idempotent - safe to call multiple times (returns existing registry).
 *
 * Reads the admin-configured job retention once; changing the retention
 * config requires a server restart to take effect.
 */
export async function initializeQueues(): Promise<QueueRegistry> {
  const existing = globalForRegistry.queueRegistry;

  if (existing) {
    log.debug("Queue registry already initialized");

    return existing;
  }

  // The in-flight promise is global too, so a second module instance joins the
  // first one's initialization instead of building a rival set of queues.
  const inFlight = globalForRegistry.queueRegistryInitializing;

  if (inFlight) {
    return inFlight;
  }

  const initializing = (async () => {
    log.info("Initializing queue registry...");

    const retention = await loadJobRetention();
    const removal = buildRemovalOptions(retention);

    const created: QueueRegistry = {
      recipeImport: operationAwareQueue(QUEUE_NAMES.RECIPE_IMPORT, recipeImportJobOptions, removal),
      imageImport: operationAwareQueue(
        QUEUE_NAMES.IMAGE_IMPORT,
        imageImportJobOptions,
        capImageImportAge(removal)
      ),
      pasteImport: operationAwareQueue(QUEUE_NAMES.PASTE_IMPORT, pasteImportJobOptions, removal),
      nutritionEstimation: operationAwareQueue(
        QUEUE_NAMES.NUTRITION_ESTIMATION,
        nutritionEstimationJobOptions,
        removal
      ),
      autoTagging: operationAwareQueue(QUEUE_NAMES.AUTO_TAGGING, autoTaggingJobOptions, removal),
      autoCategorization: operationAwareQueue(
        QUEUE_NAMES.AUTO_CATEGORIZATION,
        autoCategorizationJobOptions,
        removal
      ),
      allergyDetection: operationAwareQueue(
        QUEUE_NAMES.ALLERGY_DETECTION,
        allergyDetectionJobOptions,
        removal
      ),
      recipeProvenance: operationAwareQueue(
        QUEUE_NAMES.RECIPE_PROVENANCE,
        recipeProvenanceJobOptions,
        removal
      ),
      ingredientLinking: operationAwareQueue(
        QUEUE_NAMES.INGREDIENT_LINKING,
        ingredientLinkingJobOptions,
        removal
      ),
      imageGeneration: operationAwareQueue(
        QUEUE_NAMES.IMAGE_GENERATION,
        imageGenerationJobOptions,
        removal
      ),
      caldavSync: operationAwareQueue(QUEUE_NAMES.CALDAV_SYNC, caldavSyncJobOptions, removal),
      scheduledTasks: plainQueue(QUEUE_NAMES.SCHEDULED_TASKS, scheduledTasksJobOptions, removal),
      storeLookup: plainQueue(QUEUE_NAMES.STORE_LOOKUP, storeLookupJobOptions, removal),
      ingredientReview: operationAwareQueue(
        QUEUE_NAMES.INGREDIENT_REVIEW,
        ingredientReviewJobOptions,
        removal
      ),
      ingredientIcons: operationAwareQueue(
        QUEUE_NAMES.INGREDIENT_ICONS,
        ingredientIconsJobOptions,
        removal
      ),
      newIngredients: operationAwareQueue(
        QUEUE_NAMES.NEW_INGREDIENTS,
        newIngredientsJobOptions,
        removal
      ),
    };

    // A stream grown under the old cap is cut to the new one once, here.
    await Promise.all(
      Object.values(created).map((queue) =>
        queue.trimEvents(EVENTS_MAX_LEN).catch((err: unknown) => {
          log.warn({ err, queueName: queue.name }, "Could not trim a queue's events stream");
        })
      )
    );

    globalForRegistry.queueRegistry = created;

    log.info({ retention }, "Queue registry initialized");

    return created;
  })();

  globalForRegistry.queueRegistryInitializing = initializing;

  try {
    return await initializing;
  } finally {
    globalForRegistry.queueRegistryInitializing = null;
  }
}

/**
 * Get the queue registry. Throws if not initialized.
 * Use this in application code that needs queue access.
 */
export function getQueues(): QueueRegistry {
  const registry = globalForRegistry.queueRegistry;

  if (!registry) {
    throw new Error("Queue registry not initialized. Call initializeQueues() at server startup.");
  }

  return registry;
}

/**
 * Get a single queue by its BullMQ queue name. Throws if not initialized.
 */
export function getQueueByName(name: QueueName): Queue {
  const byName: Record<QueueName, Queue> = {
    [QUEUE_NAMES.RECIPE_IMPORT]: getQueues().recipeImport,
    [QUEUE_NAMES.IMAGE_IMPORT]: getQueues().imageImport,
    [QUEUE_NAMES.PASTE_IMPORT]: getQueues().pasteImport,
    [QUEUE_NAMES.NUTRITION_ESTIMATION]: getQueues().nutritionEstimation,
    [QUEUE_NAMES.AUTO_TAGGING]: getQueues().autoTagging,
    [QUEUE_NAMES.AUTO_CATEGORIZATION]: getQueues().autoCategorization,
    [QUEUE_NAMES.ALLERGY_DETECTION]: getQueues().allergyDetection,
    [QUEUE_NAMES.RECIPE_PROVENANCE]: getQueues().recipeProvenance,
    [QUEUE_NAMES.INGREDIENT_LINKING]: getQueues().ingredientLinking,
    [QUEUE_NAMES.IMAGE_GENERATION]: getQueues().imageGeneration,
    [QUEUE_NAMES.CALDAV_SYNC]: getQueues().caldavSync,
    [QUEUE_NAMES.SCHEDULED_TASKS]: getQueues().scheduledTasks,
    [QUEUE_NAMES.STORE_LOOKUP]: getQueues().storeLookup,
    [QUEUE_NAMES.INGREDIENT_REVIEW]: getQueues().ingredientReview,
    [QUEUE_NAMES.INGREDIENT_ICONS]: getQueues().ingredientIcons,
    [QUEUE_NAMES.NEW_INGREDIENTS]: getQueues().newIngredients,
  };

  return byName[name];
}

/**
 * Get all queues with their BullMQ names. Throws if not initialized.
 */
export function getAllQueueEntries(): { name: QueueName; queue: Queue }[] {
  return (Object.values(QUEUE_NAMES) as QueueName[]).map((name) => ({
    name,
    queue: getQueueByName(name),
  }));
}

/**
 * Close all queues. Call during server shutdown.
 */
export async function closeAllQueues(): Promise<void> {
  const registry = globalForRegistry.queueRegistry;

  if (!registry) {
    log.debug("No queue registry to close");

    return;
  }

  log.info("Closing all queues...");

  await Promise.all([
    registry.recipeImport.close(),
    registry.imageImport.close(),
    registry.pasteImport.close(),
    registry.nutritionEstimation.close(),
    registry.autoTagging.close(),
    registry.autoCategorization.close(),
    registry.allergyDetection.close(),
    registry.recipeProvenance.close(),
    registry.ingredientLinking.close(),
    registry.imageGeneration.close(),
    registry.caldavSync.close(),
    registry.scheduledTasks.close(),
    registry.storeLookup.close(),
    registry.ingredientReview.close(),
    registry.ingredientIcons.close(),
    registry.newIngredients.close(),
  ]);

  globalForRegistry.queueRegistry = null;

  log.info("All queues closed");
}
