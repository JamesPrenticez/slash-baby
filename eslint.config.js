import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
	globalIgnores([".claude", "dist", "server/dist", "casino/dist", "release", "coverage", "playwright-report"]),
	{
		files: ["**/*.{js,jsx}"],
		extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
		plugins: {
			"simple-import-sort": simpleImportSort
		},
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
			parserOptions: {
				ecmaVersion: "latest",
				ecmaFeatures: { jsx: true },
				sourceType: "module"
			}
		},
		rules: {
			"no-unused-vars": [
				"error",
				{
					varsIgnorePattern: "^[A-Z_]",
					argsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_"
				}
			],
			"simple-import-sort/imports": "error",
			"simple-import-sort/exports": "error"
		}
	},
	{
		files: ["vite.config.js", "vite.config.ts"],
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		}
	},
	{
		files: ["**/*.{ts,tsx}"],
		extends: [
			js.configs.recommended,
			...tseslint.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite
		],
		plugins: {
			"simple-import-sort": simpleImportSort
		},
		languageOptions: {
			parser: tseslint.parser,
			ecmaVersion: 2020,
			globals: globals.browser,
			parserOptions: {
				ecmaVersion: "latest",
				ecmaFeatures: { jsx: true },
				sourceType: "module"
			}
		},
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					varsIgnorePattern: "^[A-Z_]",
					argsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_"
				}
			],
			"simple-import-sort/imports": [
				"error",
				{
					groups: [
						["^node:"],
						["^react", "^@?\\w"],
						// "@/" is the only alias; it can't match "^@?\\w" above
						// because "/" isn't a word character.
						["^@/"],
						["^\\./", "^\\."]
					]
				}
			],
			"simple-import-sort/exports": "error"
		}
	},
	{
		// Enforces the "@/" half of the directory standard. Scoped to src/
		// because the alias only resolves there — e2e/, scripts/ and the root
		// config files legitimately import by relative path.
		files: ["src/**/*.{ts,tsx,js,jsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["../*"],
							message: 'Import across directories with the "@/" alias; "./" for siblings.'
						}
					]
				}
			]
		}
	},
	{
		// server/ is Node, not browser. The block above applies
		// globals.browser to every .ts file in the repo, which would have these
		// two workspaces linted against the wrong environment.
		files: ["server/**/*.ts"],
		languageOptions: {
			globals: globals.node
		}
	},
	// Must stay last: turns off every ESLint rule that would fight Prettier
	// over whitespace. Formatting is Prettier's job, correctness is ESLint's.
	prettier
]);
