import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import security from "eslint-plugin-security";
import noSecrets from "eslint-plugin-no-secrets";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**", "node_modules/**"]),
  {
    files: ["src/**/*.{js,jsx}"],
    ...js.configs.recommended,
    plugins: {
      react,
      security,
      "no-secrets": noSecrets,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "react/jsx-uses-vars": "error",
      "security/detect-buffer-noassert": "warn",
      "security/detect-child-process": "off",
      "security/detect-disable-mustache-escape": "off",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "warn",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-non-literal-require": "off",
      "security/detect-object-injection": "off",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "warn",
      "security/detect-unsafe-regex": "warn",
      "no-secrets/no-secrets": [
        "error",
        {
          tolerance: 4.2,
        },
      ],
    },
  },
  {
    files: ["src/**/*.test.{js,jsx}"],
    rules: {
      "no-secrets/no-secrets": "off",
    },
  },
  {
    files: ["src/components/authPkce.js"],
    rules: {
      "no-secrets/no-secrets": "off",
    },
  },
]);
