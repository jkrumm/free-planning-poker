import React from 'react';

import Document, { Head, Html, Main, NextScript } from 'next/document';

import { createGetInitialProps } from '@mantine/next';

import Footer from 'fpp/components/layout/footer';

const getInitialProps = createGetInitialProps();

export default class _Document extends Document {
  static getInitialProps = getInitialProps;

  render() {
    return (
      <Html>
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
        <Footer />
      </Html>
    );
  }
}
