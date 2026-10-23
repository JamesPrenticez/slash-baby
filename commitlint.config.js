// Enforced by .husky/commit-msg. Conventional Commits, narrowed to this repo

/** @type {import("@commitlint/types").UserConfig} */
export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			["feat", "feature", "fix", "refactor", "docs", "chore", "style", "test", "build", "ci", "perf", "revert"]
		],
		"type-case": [2, "always", "lower-case"],
		"type-empty": [2, "never"],
		"subject-empty": [2, "never"],

		// Scope stays optional - no agreed scope vocabulary yet.
		"scope-empty": [0],
		"header-max-length": [2, "always", 100],

		"subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
		"subject-full-stop": [1, "never", "."],
		"body-max-line-length": [0]
	}
};
