const { withAxiom } = require("next-axiom");

module.exports = withAxiom({
  reactStrictMode: true,
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
});
