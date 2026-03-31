import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.ts"],
        rules: {
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            }],
        },
    },
    {
        files: ["src/test/**/*.ts"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
    {
        ignores: ["out/**", "dist/**", "out-tests/**"],
    }
);
