import React from 'react';

import Document, { Head, Html, Main, NextScript } from 'next/document';

import { createGetInitialProps } from '@mantine/next';

const getInitialProps = createGetInitialProps();

export default class _Document extends Document {
  static getInitialProps = getInitialProps;

  render() {
    return (
      <Html className="dark prose prose-invert prose-dark">
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
