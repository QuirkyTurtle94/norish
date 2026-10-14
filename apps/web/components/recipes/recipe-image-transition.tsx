import type { ReactNode } from "react";
import { ViewTransition } from "react";

/**
 * A recipe's picture as one object across a navigation: the card's image
 * carries into the recipe page's hero. Only the pair morphs (`default="none"`),
 * and globals.css skips the morph for readers who prefer reduced motion.
 */
export function RecipeImageTransition({
  recipeId,
  children,
}: {
  recipeId: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition default="none" name={`recipe-image-${recipeId}`} share="morph">
      {children}
    </ViewTransition>
  );
}
