"use client";

import type { ComponentProps } from "react";
import { PublicSmartInstruction } from "@/components/recipe/public-smart-instruction";
import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";

import { usePublicRecipeContext } from "../public/public-recipe-context";

// The steps list passes `token` as optional, since private pages have none; a
// share page always has one, so read it from the share's own context.
function ShareInstruction(
  props: Omit<ComponentProps<typeof PublicSmartInstruction>, "token"> & { token?: string }
) {
  const { token } = usePublicRecipeContext();

  return <PublicSmartInstruction {...props} token={token} />;
}

export function ShareRecipeSteps() {
  const { recipe, state, token, units } = usePublicRecipeContext();

  return (
    <ReadonlyStepsList
      enableTimers
      interactive
      InstructionComponent={ShareInstruction}
      ingredients={state.adjustedIngredients}
      recipeId={token}
      recipeName={recipe.name}
      steps={recipe.steps}
      systemUsed={state.activeSystem}
      token={token}
      units={units}
    />
  );
}
