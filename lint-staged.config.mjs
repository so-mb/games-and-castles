export default {
  "*.{js,mjs,ts,tsx}": ["prettier --write", "eslint --fix --max-warnings 0"],
  "*.{css,json,md,yml,yaml,html}": "prettier --write",
};
