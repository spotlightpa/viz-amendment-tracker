const purgecss = require("@fullhuman/postcss-purgecss")({
  content: ["./hugo_stats.json"],
  defaultExtractor: (content) => {
    let els = JSON.parse(content).htmlElements;
    return [...els.tags, ...els.classes, ...els.ids];
  },
  safelist: {
    standard: [/hidden|sm:block|sm:invisible/],
    deep: [
      // Don't purge attributes
      /disabled|multiple|readonly|rows|type|x-cloak/,
    ],
    greedy: [/leaflet/],
  },
});

module.exports = {
  plugins: [
    require("tailwindcss"),
    require("autoprefixer"),
    ...(process.env.HUGO_ENVIRONMENT !== "development" ? [purgecss] : []),
  ],
};
