import React from 'react';

import Head from 'next/head';

import { ColorSchemeScript } from '@mantine/core';

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
        content="The best free planning poker app for agile teams and story point estimation. Incredibly user-friendly planning tool. Open source and privacy focused."
      />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content={robots ?? 'all'} />
      <title>
        {title
          ? `Free Planning Poker - ${title}`
          : 'Free Planning Poker | Quick & Easy Estimates'}
      </title>
      <meta
        property="og:description"
        content="The best free planning poker app for agile teams and story point estimation. Incredibly user-friendly planning tool. Open source and privacy focused."
      />
      <meta property="og:site_name" content="Free-Planning-Poker.com" />
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
        rel="icon"
        type="image/png"
        href="/favicon-96x96.png"
        sizes="96x96"
      />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="shortcut icon" href="/favicon.ico" />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/apple-touch-icon.png"
      />
      <meta name="apple-mobile-web-app-title" content="FPP" />
      <link rel="manifest" href="/site.webmanifest" />
      <meta name="theme-color" content="#1a1b1e" />
      <meta name="darkreader-lock" />
      <ColorSchemeScript defaultColorScheme="dark" />
    </Head>
  );
};
