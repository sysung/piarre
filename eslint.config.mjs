import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-package/**",
      "**/dist-test/**",
      "**/node_modules/**",
      "**/.vscode-test/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "vscode",
                "apps/vscode",
                "apps/vscode/**",
                "**/apps/vscode",
                "**/apps/vscode/**",
                "@piarre/vscode",
              ],
              message: "Core must remain independent of editor integrations.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression[source.value='vscode']",
          message: "Core must remain independent of editor integrations.",
        },
        {
          selector: "ImportExpression[source.value=/apps\\/vscode/]",
          message: "Core must remain independent of editor integrations.",
        },
      ],
    },
  },
);
