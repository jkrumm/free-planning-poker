// @ts-check
import { withAxiom } from "next-axiom";

await import("./src/env.mjs");

/** @type {import("next").NextConfig} */
const config = withAxiom({
  reactStrictMode: true,
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
});

export default config;
