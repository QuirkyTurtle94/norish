/**
 * Recipe Import Queue Tests
 *
 * The policy-aware deduplication id, and the in-flight check the image and
 * paste imports still use. The producer's deduplication itself runs against
 * a real Redis in ../recipe-import/producer-redis.test.ts.
 */

// @vitest-environment node

import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { RecipeImportJobData } from "@norish/queue/contracts/job-types";

// Mock BullMQ
const mockAdd = vi.fn();
const mockGetJob = vi.fn();
const mockClose = vi.fn();

// Create a mock queue instance for tests - typed to match Queue interface
const mockQueue: Pick<Queue<RecipeImportJobData>, "add" | "getJob" | "close"> = {
  add: mockAdd,
  getJob: mockGetJob,
  close: mockClose,
};

vi.mock("bullmq", () => {
  return {
    Queue: class MockQueue {
      add = mockAdd;
      getJob = mockGetJob;
      close = mockClose;
    },
    Worker: class MockWorker {
      on = vi.fn();
      close = vi.fn();
    },
    Job: class MockJob {},
  };
});

// Mock config loader
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn(),
}));

// Mock server config
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    REDIS_URL: "redis://localhost:6379",
    UPLOADS_DIR: "/tmp/uploads",
    YT_DLP_BIN_DIR: "/tmp/bin",
  },
}));

// Mock queue config to avoid URL parsing issues
vi.mock("@norish/queue/config", () => ({
  redisConnection: {
    host: "localhost",
    port: 6379,
    password: undefined,
  },
  recipeImportJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  caldavSyncJobOptions: {
    attempts: 10,
    backoff: { type: "exponential", delay: 60000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  scheduledTasksJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  nutritionEstimationJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  autoTaggingJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  allergyDetectionJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  imageImportJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  pasteImportJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  QUEUE_NAMES: {
    RECIPE_IMPORT: "recipe-import",
    IMAGE_IMPORT: "image-recipe-import",
    PASTE_IMPORT: "paste-recipe-import",
    CALDAV_SYNC: "caldav-sync",
    SCHEDULED_TASKS: "scheduled-tasks",
    NUTRITION_ESTIMATION: "nutrition-estimation",
    AUTO_TAGGING: "auto-tagging",
    ALLERGY_DETECTION: "allergy-detection",
  },
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLogger),
};

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: vi.fn(() => mockLogger),
  parserLogger: mockLogger,
}));

describe("Recipe Import Queue", () => {
  describe("generateJobId", () => {
    it("generates global job ID for 'everyone' policy", async () => {
      const { generateJobId } = await import("@norish/queue/helpers");

      const jobId = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "everyone"
      );

      expect(jobId).toBe("import_example.com_recipe");
      expect(jobId).not.toContain("user-123");
      expect(jobId).not.toContain("household-456");
    }, 15_000);

    it("generates household-scoped job ID for 'household' policy", async () => {
      const { generateJobId } = await import("@norish/queue/helpers");

      const jobId = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "household"
      );

      expect(jobId).toBe("import_household-456_example.com_recipe");
      expect(jobId).toContain("household-456");
      expect(jobId).not.toContain("user-123");
    });

    it("generates user-scoped job ID for 'owner' policy", async () => {
      const { generateJobId } = await import("@norish/queue/helpers");

      const jobId = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "owner"
      );

      expect(jobId).toBe("import_user-123_example.com_recipe");
      expect(jobId).toContain("user-123");
      expect(jobId).not.toContain("household-456");
    });

    it("normalizes URLs (lowercase, removes trailing slash)", async () => {
      const { generateJobId } = await import("@norish/queue/helpers");

      const jobId1 = generateJobId(
        "https://Example.COM/Recipe/",
        "user-123",
        "household-456",
        "everyone"
      );

      const jobId2 = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "everyone"
      );

      expect(jobId1).toBe(jobId2);
    });

    it("removes tracking parameters from URLs", async () => {
      const { generateJobId } = await import("@norish/queue/helpers");

      const jobId1 = generateJobId(
        "https://example.com/recipe?utm_source=test&utm_medium=email",
        "user-123",
        "household-456",
        "everyone"
      );

      const jobId2 = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "everyone"
      );

      expect(jobId1).toBe(jobId2);
    });
  });

  describe("isJobInQueue", () => {
    it("returns true when job is waiting", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("waiting"),
      });

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(true);
    });

    it("returns true when job is active", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("active"),
      });

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(true);
    });

    it("returns true when job is delayed", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("delayed"),
      });

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(true);
    });

    it("returns false when job is completed", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("completed"),
      });

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(false);
    });

    it("returns false when job is failed", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("failed"),
      });

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(false);
    });

    it("returns false when job does not exist", async () => {
      mockGetJob.mockResolvedValue(null);

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "nonexistent-job-id");

      expect(result).toBe(false);
    });
  });
});
