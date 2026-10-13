// @vitest-environment node
/**
 * Perplexity retired its Sonar API on 2026-09-27, and its provider now speaks
 * only the Agent API. An administrator who picked a Sonar model has that id
 * stored, so it is mapped where the id becomes a model: no data migration and
 * no manual step. The mapping is the provider's own suggested starting point.
 */
import type { LanguageModel } from "ai";
import { describe, expect, it } from "vitest";

import { createModelsFromConfig } from "@norish/shared-server/ai/runtime/providers";

function modelIdOf(model: LanguageModel): string {
  return typeof model === "string" ? model : model.modelId;
}

describe("Perplexity models", () => {
  it.each([
    ["sonar", "fast"],
    ["sonar-pro", "low"],
    ["sonar-reasoning", "medium"],
    ["sonar-reasoning-pro", "medium"],
    ["sonar-deep-research", "high"],
  ])("runs a stored %s on the Agent API's %s preset", (stored, preset) => {
    const { model, visionModel } = createModelsFromConfig({
      provider: "perplexity",
      apiKey: "key",
      model: stored,
      visionModel: stored,
    });

    expect(modelIdOf(model)).toBe(preset);
    expect(modelIdOf(visionModel)).toBe(preset);
  });

  it("passes an Agent API preset or model id through unchanged", () => {
    const { model, visionModel } = createModelsFromConfig({
      provider: "perplexity",
      apiKey: "key",
      model: "xhigh",
      visionModel: "perplexity/sonar",
    });

    expect(modelIdOf(model)).toBe("xhigh");
    expect(modelIdOf(visionModel)).toBe("perplexity/sonar");
  });
});
