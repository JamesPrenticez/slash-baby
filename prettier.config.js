// prettier owns formatting, eslint owns correctness
// eslint-config-prettier is applied last in the ESLint config so it supersedes everything

/** @type {import("prettier").Config} */
export default {
	singleQuote: false,
	jsxSingleQuote: false,
	semi: true,
	useTabs: true,
	tabWidth: 2,

	printWidth: 120,

	trailingComma: "none",
	arrowParens: "avoid"
};
