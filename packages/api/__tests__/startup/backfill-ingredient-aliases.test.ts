// @vitest-environment node
/**
 * The upgrade to Ingredient Aliases (ADR-0037), against a real database. It
 * runs after the first seed, so the lines, pantry rows and groceries that
 * pointed at an instance's old ingredients are resolved from their text as a
 * new import would be, AI aside; the old rows are no foods of their own, and
 * nothing the household taught Norish is lost.
 */
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SeedEntry } from "@norish/db/repositories/ingredient-seed";
import { backfillIngredientAliases } from "@norish/api/startup/backfill-ingredient-aliases";
import { getRecipeFull } from "@norish/db";
import {
  listGroceriesWithoutAlias,
  listRecipeLinesWithoutAlias,
  listRecurringGroceriesWithoutAlias,
} from "@norish/db/repositories/ingredient-backfill";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import { listPantryIngredientsByUserIds } from "@norish/db/repositories/pantry";
import {
  groceries,
  ingredients,
  pantryIngredients,
  recipeIngredients,
  recurringGroceries,
} from "@norish/db/schema";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

function entry(offId: string, ...names: string[]): SeedEntry {
  return {
    offId,
    name: names[0]!,
    nameFold: ingredientAliasFold(names[0]!),
    parentOffId: null,
    nutrition: null,
    aliases: names.map((text) => ({ text, fold: ingredientAliasFold(text), locale: null })),
  };
}

describe("backfillIngredientAliases", () => {
  const testBase = new RepositoryTestBase("test_backfill_ingredient_aliases");

  let userId: string;
  let recipeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user, recipe] = await testBase.beforeEachTest();

    userId = user.id;
    recipeId = recipe.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** An ingredient and a line as the schema migration leaves them: no alias yet. */
  async function legacyIngredient(name: string, createdAt: Date) {
    const db = getTestDb();
    const [row] = await db.insert(ingredients).values({ name, createdAt }).returning();

    await db.insert(recipeIngredients).values({ recipeId, name, order: "0", systemUsed: "metric" });

    return row!;
  }

  /** The Ingredient each of the recipe's lines points at, by the line's text. */
  async function linesOfRecipe() {
    const lines = (await getRecipeFull(recipeId))!.recipeIngredients;

    return new Map(lines.map((line) => [line.ingredientName, line.ingredientId]));
  }

  async function ingredientById(id: string) {
    const [row] = await getTestDb()
      .select({
        name: ingredients.name,
        flagged: ingredients.flagged,
        flagReason: ingredients.flagReason,
        parentId: ingredients.parentId,
      })
      .from(ingredients)
      .where(eq(ingredients.id, id));

    return row ?? null;
  }

  it("resolves an old line to the seeded food its text names", async () => {
    await applyIngredientSeed([entry("en:garlic", "garlic", "knoflook")]);
    await legacyIngredient("knoflook (fijngehakt)", new Date("2025-01-01"));

    await backfillIngredientAliases();

    const garlic = (await listSeededIngredientIds()).get("en:garlic");

    expect((await linesOfRecipe()).get("knoflook (fijngehakt)")).toBe(garlic);
  });

  it("mints a name the catalogue does not know as a new import would: flagged, plain, filed", async () => {
    await applyIngredientSeed([entry("en:courgette", "courgette")]);
    await legacyIngredient("gegrilde courgette, in plakjes", new Date("2025-01-01"));
    await legacyIngredient("kleine courgette, in kleine blokjes", new Date("2025-01-01"));

    await backfillIngredientAliases();

    const lines = await linesOfRecipe();
    const courgette = (await listSeededIngredientIds()).get("en:courgette");

    await expect(ingredientById(lines.get("gegrilde courgette, in plakjes")!)).resolves.toEqual({
      name: "gegrilde courgette",
      flagged: true,
      flagReason: "upgrade",
      parentId: courgette,
    });
    // A size is no part of the food: a small courgette is courgette.
    expect(lines.get("kleine courgette, in kleine blokjes")).toBe(courgette);
  });

  it("gives lines that name one food the one Ingredient, with no seed at all", async () => {
    await legacyIngredient("Crème fraîche", new Date("2025-01-01"));
    await legacyIngredient("creme fraiche, cold", new Date("2025-06-01"));

    await backfillIngredientAliases();

    const lines = await linesOfRecipe();

    expect(lines.get("Crème fraîche")).toBeTruthy();
    expect(lines.get("creme fraiche, cold")).toBe(lines.get("Crème fraîche"));
  });

  it("reads an old line's food past the unit its import left beside the number, and leaves the line as written", async () => {
    await applyIngredientSeed([entry("en:puff-pastry", "puff pastry", "bladerdeeg")]);
    await getTestDb()
      .insert(recipeIngredients)
      .values([
        { recipeId, name: "rol bladerdeeg", amount: "1", order: "0", systemUsed: "metric" },
        // Without a number, a unit word may be the food's own ("glass noodles"): read as written.
        { recipeId, name: "rol bladerdeeg", order: "1", systemUsed: "metric" },
      ]);

    await backfillIngredientAliases();

    const pastry = (await listSeededIngredientIds()).get("en:puff-pastry");
    const [counted, uncounted] = (await getRecipeFull(recipeId))!.recipeIngredients;

    expect(counted).toMatchObject({
      ingredientName: "rol bladerdeeg",
      amount: 1,
      unit: null,
      ingredientId: pastry,
    });
    expect(uncounted!.ingredientName).toBe("rol bladerdeeg");
    expect(uncounted!.ingredientId).not.toBe(pastry);
  });

  it("leaves a heading without an alias, as naming no food", async () => {
    await applyIngredientSeed([entry("en:sauce", "sauce")]);
    await legacyIngredient("# Sauce", new Date("2025-01-01"));

    await backfillIngredientAliases();

    expect((await linesOfRecipe()).get("# Sauce")).toBeNull();
    await expect(listRecipeLinesWithoutAlias(10)).resolves.toEqual([]);
    await expect(
      getTestDb().select().from(ingredients).where(eq(ingredients.name, "# Sauce"))
    ).resolves.toEqual([]);
  });

  it("keeps an old row the seed adopted by its name, under the seed's name", async () => {
    const salt = await legacyIngredient("Salt", new Date("2025-01-01"));

    // At boot the seed comes first, and takes the row that holds its name.
    await applyIngredientSeed([entry("en:salt", "salt", "zout")]);
    await backfillIngredientAliases();

    expect((await linesOfRecipe()).get("Salt")).toBe(salt.id);
    await expect(ingredientById(salt.id)).resolves.toMatchObject({ name: "salt", flagged: false });
  });

  it("mints into an old row that holds the plain name, flag and all", async () => {
    const olive = await legacyIngredient("Olive Oil", new Date("2025-01-01"));

    await backfillIngredientAliases();

    expect((await linesOfRecipe()).get("Olive Oil")).toBe(olive.id);
    await expect(ingredientById(olive.id)).resolves.toMatchObject({
      name: "Olive Oil",
      flagged: true,
      flagReason: "upgrade",
    });
  });

  it("removes the old rows nothing points at any more", async () => {
    await legacyIngredient("kleine courgette, in kleine blokjes", new Date("2025-01-01"));
    const [orphan] = await getTestDb()
      .insert(ingredients)
      .values({ name: "from a deleted recipe" })
      .returning();

    await backfillIngredientAliases();

    await expect(
      getTestDb()
        .select({ name: ingredients.name })
        .from(ingredients)
        .where(inArray(ingredients.name, ["kleine courgette, in kleine blokjes", orphan!.name]))
    ).resolves.toEqual([]);
  });

  it("points every existing recipe line at an alias", async () => {
    await legacyIngredient("Olive Oil", new Date("2025-01-01"));
    await legacyIngredient("olive oil!", new Date("2025-06-01"));

    await backfillIngredientAliases();

    await expect(listRecipeLinesWithoutAlias(10)).resolves.toEqual([]);
  });

  it("keeps every Pantry Ingredient, and it covers the recipe lines of its food", async () => {
    await legacyIngredient("Crème fraîche", new Date("2025-01-01"));
    const [twin] = await getTestDb()
      .insert(ingredients)
      .values({ name: "creme fraiche", createdAt: new Date("2025-06-01") })
      .returning();

    await getTestDb().insert(pantryIngredients).values({ userId, ingredientId: twin!.id });

    await backfillIngredientAliases();

    const pantry = await listPantryIngredientsByUserIds([userId]);
    const [line] = (await getRecipeFull(recipeId))!.recipeIngredients;

    expect(pantry).toHaveLength(1);
    expect(pantry[0]!.ingredientId).toBe(line!.ingredientId);
    expect(pantryIngredientFor(pantry, line!)).not.toBeNull();
  });

  it("passes over a grocery whose name is markup alone, and resolves the rest", async () => {
    await getTestDb()
      .insert(groceries)
      .values([
        { userId, name: "<b></b>" },
        { userId, name: "Uien" },
      ]);

    await backfillIngredientAliases();

    await expect(listGroceriesWithoutAlias(10)).resolves.toEqual([
      expect.objectContaining({ name: "<b></b>" }),
    ]);
  });

  it("resolves every grocery and recurring grocery, and leaves the text on the list alone", async () => {
    await legacyIngredient("Olive Oil", new Date("2025-01-01"));
    await getTestDb()
      .insert(groceries)
      .values([
        { userId, name: "olive oil!" },
        { userId, name: "Uien" },
        { userId, name: null },
      ]);
    await getTestDb().insert(recurringGroceries).values({
      userId,
      name: "Melk",
      recurrenceRule: "week",
      nextPlannedFor: "2025-12-01",
    });

    await backfillIngredientAliases();

    // A line with no name names no food, and has nothing to resolve.
    await expect(listGroceriesWithoutAlias(10)).resolves.toEqual([]);
    await expect(listRecurringGroceriesWithoutAlias(10)).resolves.toEqual([]);

    const names = await getTestDb().select({ name: groceries.name }).from(groceries);

    expect(names.map((row) => row.name).sort()).toEqual(["Uien", "olive oil!", null].sort());
  });
});
