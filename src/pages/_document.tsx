import { createGetInitialProps } from "@mantine/next";
import Document, { Head, Html, Main, NextScript } from "next/document";
import PlausibleProvider from "next-plausible";

const getInitialProps = createGetInitialProps();

export default class _Document extends Document {
  static getInitialProps = getInitialProps;

  render() {
    return (
      <Html>
        <Head />
        <PlausibleProvider domain={"planning-poker-jkrumm.vercel.app"}>
          <body>
            <Main />
            <NextScript />
          </body>
        </PlausibleProvider>
      </Html>
    );
  }
}
