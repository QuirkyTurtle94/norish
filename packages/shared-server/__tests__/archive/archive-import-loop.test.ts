import { beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment node

const mockFindExistingRecipe = vi.fn();
const mockCreateRecipeWithRefs = vi.fn();
const mockUpdateRecipeWithRefs = vi.fn();
const mockDashboardRecipe = vi.fn();
const mockFindOwnCookbookIdByTitle = vi.fn();
const mockCreateCookbook = vi.fn();
const mockAddRecipeToCookbook = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn().mockRejectedValue(new Error("missing")),
    mkdir: vi.fn(),
    cp: vi.fn(),
    rm: vi.fn(),
  },
}));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { UPLOADS_DIR: "/tmp/uploads" },
}));

vi.mock("@norish/db", () => ({
  findExistingRecipe: mockFindExistingRecipe,
  dashboardRecipe: mockDashboardRecipe,
}));

vi.mock("@norish/shared-server/ingredients/recipe-lines", () => ({
  createResolvedRecipe: vi.fn((id: string, userId: unknown, payload: object) =>
    mockCreateRecipeWithRefs(id, userId, payload)
  ),
  updateResolvedRecipe: vi.fn((id: string, userId: unknown, payload: object) =>
    mockUpdateRecipeWithRefs(id, userId, payload)
  ),
}));

vi.mock("@norish/db/repositories/ratings", () => ({ rateRecipe: vi.fn() }));
vi.mock("@norish/db/repositories/favorites", () => ({ addFavorite: vi.fn() }));
vi.mock("@norish/db/repositories/cuisines", () => ({
  listCuisines: vi.fn().mockResolvedValue([]),
}));
vi.mock("@norish/db/repositories/cookbooks", () => ({
  findOwnCookbookIdByTitle: mockFindOwnCookbookIdByTitle,
  createCookbook: mockCreateCookbook,
  addRecipeToCookbook: mockAddRecipeToCookbook,
}));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));
vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: vi.fn(),
  saveStepImageBytes: vi.fn(),
  saveVideoBytes: vi.fn(),
}));

let nextId = 0;

function item(name: string, url: string | undefined, extra: Record<string, unknown> = {}) {
  const id = `recipe-${++nextId}`;

  return {
    dto: { id, name, url, recipeIngredients: [], steps: [], tags: [], images: [], videos: [] },
    fileName: `recipe_${name}`,
    ...extra,
  };
}

async function* itemsOf(items: unknown[]) {
  for (const entry of items) yield entry;
}

async function runLoop(items: unknown[]) {
  const { importRecipeItems } = await import("@norish/shared-server/archive/parser");

  return importRecipeItems(itemsOf(items) as never, "user-1", ["user-1"]);
}

describe("the archive import loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockImplementation(async (recipeId: string) => ({
      status: "inserted",
      recipeId,
    }));
    mockUpdateRecipeWithRefs.mockResolvedValue({ status: "applied" });
    mockDashboardRecipe.mockImplementation(async (recipeId: string) => ({ id: recipeId }));
    mockFindOwnCookbookIdByTitle.mockResolvedValue(null);
    mockCreateCookbook.mockImplementation(async ({ title }: { title: string }) => ({
      id: `cookbook-${title}`,
    }));
  });

  describe("matching", () => {
    it("never overwrites a recipe it created this run by name", async () => {
      const first = item("Pollo al curry", "https://a.example/curry");
      const second = item("Pollo al curry", undefined);

      // The stored lookup finds the first recipe by its name.
      mockFindExistingRecipe
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ recipeId: first.dto.id, by: "name" });

      const result = await runLoop([first, second]);

      expect(mockCreateRecipeWithRefs).toHaveBeenCalledTimes(2);
      expect(mockUpdateRecipeWithRefs).not.toHaveBeenCalled();
      expect(result.imported).toHaveLength(2);
    });

    it("never overwrites a recipe it overwrote this run by name", async () => {
      mockFindExistingRecipe.mockResolvedValue({ recipeId: "existing-1", by: "name" });

      await runLoop([item("Tiramisù", undefined), item("Tiramisù", undefined)]);

      expect(mockUpdateRecipeWithRefs).toHaveBeenCalledTimes(1);
      expect(mockCreateRecipeWithRefs).toHaveBeenCalledTimes(1);
    });

    it("collapses an exact copy (same URL twice) into one recipe", async () => {
      const first = item("Pollo al curry", "https://a.example/curry");
      const copy = item("Pollo al curry", "https://a.example/curry");

      mockFindExistingRecipe
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ recipeId: first.dto.id, by: "url" });

      await runLoop([first, copy]);

      expect(mockCreateRecipeWithRefs).toHaveBeenCalledTimes(1);
      expect(mockUpdateRecipeWithRefs).toHaveBeenCalledWith(
        first.dto.id,
        "user-1",
        expect.objectContaining({ name: "Pollo al curry" })
      );
    });

    it("still overwrites a same-named recipe that was there before the run", async () => {
      mockFindExistingRecipe.mockResolvedValue({ recipeId: "existing-1", by: "name" });

      await runLoop([item("Tiramisù", undefined)]);

      expect(mockUpdateRecipeWithRefs).toHaveBeenCalledWith(
        "existing-1",
        "user-1",
        expect.objectContaining({ name: "Tiramisù" })
      );
      expect(mockCreateRecipeWithRefs).not.toHaveBeenCalled();
    });
  });

  describe("the enrichment hand-off", () => {
    it("reports the recipes it inserted and not the ones it overwrote", async () => {
      const fresh = item("Risotto", undefined);

      mockFindExistingRecipe
        .mockResolvedValueOnce({ recipeId: "existing-1", by: "url" })
        .mockResolvedValueOnce(null);

      const result = await runLoop([item("Tiramisù", "https://a.example/t"), fresh]);

      expect(result.imported).toHaveLength(2);
      expect(result.inserted).toEqual([{ status: "inserted", recipeId: fresh.dto.id }]);
    });
  });

  describe("cookbook filing", () => {
    it("files into the importer's own same-titled cookbook, whatever its case", async () => {
      mockFindOwnCookbookIdByTitle.mockResolvedValue("dolci-id");

      const recipe = item("Tiramisù", undefined, { cookbooks: ["  dolci "] });

      await runLoop([recipe]);

      expect(mockFindOwnCookbookIdByTitle).toHaveBeenCalledWith("user-1", "dolci");
      expect(mockCreateCookbook).not.toHaveBeenCalled();
      expect(mockAddRecipeToCookbook).toHaveBeenCalledWith("dolci-id", recipe.dto.id);
    });

    it("makes a missing cookbook once and reuses it for the rest of the run", async () => {
      const first = item("Tiramisù", undefined, { cookbooks: ["Kerst"] });
      const second = item("Panettone", undefined, { cookbooks: ["kerst"] });

      await runLoop([first, second]);

      expect(mockFindOwnCookbookIdByTitle).toHaveBeenCalledTimes(1);
      expect(mockCreateCookbook).toHaveBeenCalledTimes(1);
      expect(mockCreateCookbook).toHaveBeenCalledWith({ userId: "user-1", title: "Kerst" });
      expect(mockAddRecipeToCookbook).toHaveBeenCalledWith("cookbook-Kerst", first.dto.id);
      expect(mockAddRecipeToCookbook).toHaveBeenCalledWith("cookbook-Kerst", second.dto.id);
    });

    it("files an overwritten recipe too", async () => {
      mockFindExistingRecipe.mockResolvedValue({ recipeId: "existing-1", by: "url" });

      await runLoop([item("Tiramisù", "https://a.example/t", { cookbooks: ["Dolci"] })]);

      expect(mockAddRecipeToCookbook).toHaveBeenCalledWith("cookbook-Dolci", "existing-1");
    });

    it("never fails the import when filing fails", async () => {
      mockAddRecipeToCookbook.mockRejectedValueOnce(new Error("boom"));

      const result = await runLoop([item("Tiramisù", undefined, { cookbooks: ["Dolci"] })]);

      expect(result.imported).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it("files nothing without an importing user", async () => {
      const { importRecipeItems } = await import("@norish/shared-server/archive/parser");

      await importRecipeItems(
        itemsOf([item("Tiramisù", undefined, { cookbooks: ["Dolci"] })]) as never,
        undefined,
        ["user-1"]
      );

      expect(mockCreateCookbook).not.toHaveBeenCalled();
      expect(mockAddRecipeToCookbook).not.toHaveBeenCalled();
    });
  });
});
