import React from 'react';

import { Head, Html, Main, NextScript } from 'next/document';

import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';

export default function Document() {
  return (
    <Html
      lang="en"
      className="dark prose prose-invert prose-dark"
      {...mantineHtmlProps}
    >
      <Head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
