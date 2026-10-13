import eslintReact from "@eslint-react/eslint-plugin";
import stylistic from "@stylistic/eslint-plugin";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

export const reactConfig = defineConfig(
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // `crypto.randomUUID` exists only in a secure context. A self-hosted
      // Norish is routinely reached over plain HTTP on a LAN name, where it is
      // simply undefined and the component throws on render. Guarded forms
      // (`globalThis.crypto?.randomUUID` with a fallback) are deliberately not
      // matched.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='crypto'][property.name='randomUUID']",
          message:
            "crypto.randomUUID is undefined outside a secure context. Use createClientId() from @norish/shared/lib/operation-helpers.",
        },
      ],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [eslintReact.configs["recommended-typescript"], jsxA11y.configs.recommended],
    plugins: {
      "@stylistic": stylistic,
    },
    languageOptions: {
      globals: {
        React: "writable",
      },
    },
    rules: {
      // eslint-plugin-react-hooks below owns the hooks rules, some off on purpose;
      // these are @eslint-react's copies of them.
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/purity": "off",
      "@eslint-react/rules-of-hooks": "off",
      "@eslint-react/set-state-in-effect": "off",
      "@eslint-react/set-state-in-render": "off",
      "@stylistic/jsx-self-closing-comp": "warn",
      "@stylistic/jsx-sort-props": [
        "warn",
        {
          callbacksLast: true,
          shorthandFirst: true,
          noSortAlphabetically: false,
          reservedFirst: true,
        },
      ],
      "jsx-a11y-x/click-events-have-key-events": "warn",
      "jsx-a11y-x/interactive-supports-focus": "warn",
    },
  },
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
    },
  }
);
