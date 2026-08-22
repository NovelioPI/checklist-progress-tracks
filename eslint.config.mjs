import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["main.js", "node_modules", "**/*.js"] },
	...tseslint.configs.recommended,
	{
		rules: {
			"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
		},
	}
);
