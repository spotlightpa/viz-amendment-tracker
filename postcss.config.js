const purgecss = require("@fullhuman/postcss-purgecss")({
  content: ["./hugo_stats.json"],
  defaultExtractor: (content) => {
    let els = JSON.parse(content).htmlElements;
    return [...els.tags, ...els.classes, ...els.ids];
  },
  safelist: {
    standard: [],
    deep: [
      // Don't purge attributes
      /disabled|multiple|readonly|type|x-cloak/,
    ],
    greedy: [],
  },
});

module.exports = {
  plugins: [
    require("tailwindcss"),
    require("autoprefixer"),
    ...(process.env.HUGO_ENVIRONMENT !== "development" ? [purgecss] : []),
  ],
};
