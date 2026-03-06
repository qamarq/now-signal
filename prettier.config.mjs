/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
  singleQuote: true,
  arrowParens: "avoid",
  tabWidth: 2,
};

export default config;
