import Head from "next/head";
import React from "react";
import { ColorSchemeScript } from "@mantine/core";

export const Meta = ({
  title,
  robots,
}: {
  title?: string | null;
  robots?: string;
}) => {
  return (
    <Head>
      <meta
        name="description"
        content="Estimate your story points faster than ever. Free agile scrum sprint planning poker app based on fibanocci. Open source and privacy focused."
      />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content={robots ?? "all"} />
      <title>
        {title
          ? `Free Planning Poker - ${title}`
          : "Free Planning Poker | Estimate story points fast"}
      </title>
      <meta
        property="og:description"
        content="Estimate your story points faster than ever. Free agile scrum sprint planning poker app based on fibanocci. Open source and privacy focused."
      />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:url" content="https://free-planning-poker.com/" />
      <meta
        property="og:image"
        content="https://free-planning-poker.com/free-planning-poker.jpg"
      />
      <meta
        property="og:image:secure_url"
        content="https://free-planning-poker.com/free-planning-poker.jpg"
      />
      <meta property="og:image:type" content="image/jpg" />
      <meta property="og:image:width" content="1034" />
      <meta property="og:image:height" content="612" />
      <meta property="og:image:alt" content="Free Planning Poker" />
      <meta charSet="utf-8" />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/apple-touch-icon.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/favicon-32x32.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href="/favicon-16x16.png"
      />
      <link rel="manifest" href="/site.webmanifest" />
      <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#1971c2" />
      <meta name="msapplication-TileColor" content="#1a1b1e" />
      <meta name="theme-color" content="#1a1b1e" />
      <ColorSchemeScript defaultColorScheme="dark" />
    </Head>
  );
};
