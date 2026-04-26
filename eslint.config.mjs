import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Promote `no-explicit-any` from warning to error so type leaks fail CI.
  // PR #119 cleaned the PHI paths and a follow-up landed `unknown` plus
  // type guards across the rest of the codebase. New `any` should now be
  // a deliberate choice marked with an inline `eslint-disable-next-line`
  // comment, never a silent regression.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]);

export default eslintConfig;
