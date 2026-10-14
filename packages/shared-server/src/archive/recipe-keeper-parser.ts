import * as cheerio from "cheerio";
import JSZip from "jszip";

import { matchCategory } from "@norish/shared-server/ai/enrichment/category-matcher";
import { FullRecipeInsertDTO } from "@norish/shared/contracts";
import { parseIsoDuration } from "@norish/shared/lib/helpers";

import { buildRecipeDTO, parseServings, saveBufferImage } from "./parser-helpers";

/**
 * A Recipe Keeper export is a zip of one HTML page and a folder of photos.
 * Recipe Keeper publishes no format, so these facts come from a real export
 * and the open-source importers. Every field is read by its `itemprop`,
 * never by its label: the labels are translated ("Portate", "Porzioni") and
 * the itemprops are not.
 */
export const RECIPE_KEEPER_HTML = "recipes.html";

/** A photo the page points at: a file in the export's own `images/` folder. */
const PHOTO_PATH = /^images\/[^/\\]+$/;

/** The gallery's limit (FullRecipeInsertSchema). */
const MAX_PHOTOS = 10;

export type RecipeKeeperRecipe = {
  name: string;
  courses: string[];
  categories: string[];
  collections: string[];
  source: string;
  yield: string;
  prepTime: string;
  cookTime: string;
  /** Ingredient lines, a bold one already written as a Heading */
  ingredients: string[];
  directions: string[];
  notes: string[];
  nutrition: { calories: string; fat: string; carbs: string; protein: string };
  /** Photo paths inside the export, in Recipe Keeper's order */
  photos: string[];
  rating: string;
  favourite: string;
};

export type ParsedRecipeKeeperRecipe = {
  dto: FullRecipeInsertDTO;
  importedRating?: number;
  importedFavorite?: boolean;
  /** The recipe's collections, filed as the importer's cookbooks */
  cookbooks: string[];
};

/** The export's page, or null when the zip holds none that is Recipe Keeper's. */
export async function readRecipeKeeperHtml(zip: JSZip): Promise<string | null> {
  const file = zip.file(RECIPE_KEEPER_HTML);

  if (!file) return null;

  const html = await file.async("string");

  return html.includes('itemprop="recipeId"') ? html : null;
}

export function countRecipeKeeperRecipes(html: string): number {
  return cheerio.load(html)("div.recipe-details").length;
}

/**
 * Read every recipe block on the page. The markup is not strict HTML
 * (unclosed `<meta>`, unquoted `itemprop=photo0`), which cheerio reads as a
 * browser would.
 */
export function extractRecipeKeeperRecipes(html: string): RecipeKeeperRecipe[] {
  const $ = cheerio.load(html);

  return $("div.recipe-details")
    .toArray()
    .map((block) => {
      const $block = $(block);
      const textOf = (selection: { text(): string }) =>
        selection.text().replace(/\s+/g, " ").trim();

      // A field is a `<span>` with its value as text, or a `<meta>` with it
      // as content: the first course is the one and every further one the other.
      const values = (prop: string) =>
        $block
          .find(`[itemprop="${prop}"]`)
          .toArray()
          .map((el) =>
            el.tagName === "meta" ? ($(el).attr("content") ?? "").trim() : textOf($(el))
          )
          .filter((value) => value.length > 0);
      const value = (prop: string) => values(prop)[0] ?? "";
      const paragraphs = (prop: string) =>
        $block
          .find(`[itemprop="${prop}"] p`)
          .toArray()
          .map((p) => ({ text: textOf($(p)), bold: textOf($(p).children("b, strong")) }))
          .filter((line) => line.text.length > 0);

      return {
        name: value("name"),
        courses: values("recipeCourse"),
        categories: values("recipeCategory"),
        collections: values("recipeCollection"),
        source: value("recipeSource"),
        yield: value("recipeYield"),
        prepTime: value("prepTime"),
        cookTime: value("cookTime"),
        ingredients: paragraphs("recipeIngredients").map((line) =>
          line.bold === line.text ? `# ${line.text.replace(/:$/, "").trim()}` : line.text
        ),
        directions: paragraphs("recipeDirections")
          .map((line) => line.text.replace(/^\d+\.\s+/, ""))
          .filter((line) => line.length > 0),
        notes: paragraphs("recipeNotes").map((line) => line.text),
        nutrition: {
          calories: value("recipeNutCalories"),
          fat: value("recipeNutTotalFat"),
          carbs: value("recipeNutTotalCarbohydrate"),
          protein: value("recipeNutProtein"),
        },
        photos: $block
          .find('img[itemprop^="photo"]')
          .toArray()
          .map((img) => ({
            order: Number(($(img).attr("itemprop") ?? "").slice("photo".length)),
            src: $(img).attr("src") ?? "",
          }))
          .sort((a, b) => a.order - b.order)
          .map((photo) => photo.src),
        rating: value("recipeRating"),
        favourite: value("recipeIsFavourite"),
      };
    });
}

/** ISO 8601 minutes, with `PT0S` (Recipe Keeper's "no time") as unset. */
function minutesOf(iso: string): number | undefined {
  const minutes = parseIsoDuration(iso);

  return minutes ? minutes : undefined;
}

function nutritionValue(value: string): number | null {
  const parsed = parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/** Each name once, matched case-insensitively, as written the first time. */
function distinct<T extends string>(names: T[]): T[] {
  const seen = new Set<string>();

  return names.filter((name) => {
    const key = name.toLowerCase();

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
}

export async function parseRecipeKeeperRecipeToDTO(
  recipe: RecipeKeeperRecipe,
  recipeId: string,
  zip: JSZip
): Promise<ParsedRecipeKeeperRecipe> {
  const prepMinutes = minutesOf(recipe.prepTime);
  const cookMinutes = minutesOf(recipe.cookTime);

  const dto = await buildRecipeDTO({
    name: recipe.name,
    // Recipe Keeper also writes plain text here ("Recipe Keeper"), which is
    // no address to go back to.
    url: /^https?:\/\//i.test(recipe.source) ? recipe.source : undefined,
    servings: parseServings(recipe.yield || null),
    prepMinutes,
    cookMinutes,
    totalMinutes:
      prepMinutes !== undefined || cookMinutes !== undefined
        ? (prepMinutes ?? 0) + (cookMinutes ?? 0)
        : undefined,
    ingredientsText: recipe.ingredients.join("\n"),
    instructionsText: recipe.directions.join("\n"),
    categories: distinct([...recipe.courses, ...recipe.categories]),
  });

  const images: Array<{ image: string; order: number }> = [];

  for (const photo of recipe.photos.slice(0, MAX_PHOTOS)) {
    const file = PHOTO_PATH.test(photo) ? zip.file(photo) : null;
    const saved = file ? await saveBufferImage(await file.async("nodebuffer"), recipeId) : null;

    if (saved) images.push({ image: saved, order: images.length });
  }

  const calories = nutritionValue(recipe.nutrition.calories);
  const fat = nutritionValue(recipe.nutrition.fat);
  const carbs = nutritionValue(recipe.nutrition.carbs);
  const protein = nutritionValue(recipe.nutrition.protein);
  const rating = parseInt(recipe.rating, 10);

  return {
    dto: {
      ...dto,
      id: recipeId,
      notes: recipe.notes.join("\n") || undefined,
      // A course the matcher recognises is also its meal; a category is a label only.
      categories: distinct(
        recipe.courses.flatMap((course) => {
          const category = matchCategory(course);

          return category ? [category] : [];
        })
      ),
      calories: calories != null ? Math.round(calories) : null,
      fat: fat != null ? fat.toString() : null,
      carbs: carbs != null ? carbs.toString() : null,
      protein: protein != null ? protein.toString() : null,
      image: images[0]?.image,
      images,
    },
    importedRating: rating >= 1 && rating <= 5 ? rating : undefined,
    importedFavorite: recipe.favourite === "True" || undefined,
    cookbooks: recipe.collections,
  };
}
