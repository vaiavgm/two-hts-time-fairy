const js = require("@eslint/js");
const globals = require("globals");
const stylistic = require("@stylistic/eslint-plugin");

module.exports = [
    { ignores: ["node_modules/**", "bin/**", "obj/**"] },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: { ...globals.node },
        },
        plugins: { "@stylistic": stylistic },
        rules: {
            "curly": ["error", "multi-line", "consistent"],
            "max-nested-callbacks": ["error", { "max": 4 }],
            "no-console": "off",
            "no-empty-function": "error",
            "no-inline-comments": "error",
            "no-lonely-if": "error",
            "no-shadow": ["error", { "allow": ["err", "resolve", "reject"] }],
            "no-var": "error",
            "prefer-const": "error",
            "yoda": "error",

            "@stylistic/arrow-spacing": ["warn", { "before": true, "after": true }],
            "@stylistic/brace-style": ["error", "allman", { "allowSingleLine": true }],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
            "@stylistic/comma-spacing": "error",
            "@stylistic/comma-style": "error",
            "@stylistic/dot-location": ["error", "property"],
            "@stylistic/indent": ["error", 4],
            "@stylistic/keyword-spacing": "error",
            "@stylistic/max-statements-per-line": ["error", { "max": 2 }],
            "@stylistic/no-floating-decimal": "error",
            "@stylistic/no-multi-spaces": "error",
            "@stylistic/no-multiple-empty-lines": ["error", { "max": 2, "maxEOF": 1, "maxBOF": 0 }],
            "@stylistic/no-trailing-spaces": "error",
            "@stylistic/object-curly-spacing": ["error", "always"],
            "@stylistic/quotes": ["error", "double"],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/space-before-blocks": "error",
            "@stylistic/space-before-function-paren": ["error", {
                "anonymous": "never",
                "named": "never",
                "asyncArrow": "always",
            }],
            "@stylistic/space-in-parens": "error",
            "@stylistic/space-infix-ops": "error",
            "@stylistic/space-unary-ops": "error",
            "@stylistic/spaced-comment": "error",
        },
    },
];
