// @vitest-environment node
/**
 * How an archive import finds the recipe an entry overwrites (ADR-0022): by
 * URL first, then by name, and a name never crosses two different URLs.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { findExistingRecipe } from "@norish/db/repositories/recipes";

import { createTestRecipe } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("findExistingRecipe", () => {
  const testBase = new RepositoryTestBase("test_find_existing_recipe");
  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("matches by URL first, and says so", async () => {
    const recipe = await createTestRecipe(userId, {
      name: "Pollo al curry",
      url: "https://a.example/curry",
    });

    expect(await findExistingRecipe([userId], "https://a.example/curry", "Something else")).toEqual(
      { recipeId: recipe.id, by: "url" }
    );
  });

  it("never matches a name across two different URLs", async () => {
    await createTestRecipe(userId, { name: "Pollo al curry", url: "https://a.example/curry" });

    expect(await findExistingRecipe([userId], "https://b.example/curry", "pollo al curry")).toBe(
      null
    );
  });

  it("matches a name where either recipe has no URL", async () => {
    const stored = await createTestRecipe(userId, { name: "Tiramisù", url: null });
    const withUrl = await createTestRecipe(userId, {
      name: "Panettone",
      url: "https://a.example/panettone",
    });

    expect(await findExistingRecipe([userId], "https://b.example/t", "tiramisù")).toEqual({
      recipeId: stored.id,
      by: "name",
    });
    expect(await findExistingRecipe([userId], undefined, "Panettone")).toEqual({
      recipeId: withUrl.id,
      by: "name",
    });
  });
});
