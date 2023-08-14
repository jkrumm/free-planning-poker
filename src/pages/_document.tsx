import { createGetInitialProps } from "@mantine/next";
import Document, { Head, Html, Main, NextScript } from "next/document";
import Footer from "fpp/components/layout/footer";
import { AxiomWebVitals } from "next-axiom";
import React from "react";

const getInitialProps = createGetInitialProps();

export default class _Document extends Document {
  static getInitialProps = getInitialProps;

  render() {
    return (
      <Html>
        <AxiomWebVitals />
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
