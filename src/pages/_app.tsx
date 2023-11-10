import { type AppType } from "next/app";

import { api } from "fpp/utils/api";
import "normalize.css/normalize.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "fpp/styles/globals.css";
import React, { Suspense } from "react";
import { AxiomWebVitals } from "next-axiom";
import { MantineProvider } from "@mantine/core";
import { FeatureFlagLoaderUtil } from "fpp/utils/feature-flag-loader.util";

// const theme = createTheme({});

const MyApp: AppType = ({ Component, pageProps: { ...pageProps } }) => {
  return (
    <MantineProvider
      // withNormalizeCSS
      defaultColorScheme="dark"
      theme={
        {
          // colorScheme: "dark",
          // loader: "bars",
        }
      }
      // withGlobalStyles
    >
      <Suspense fallback={<></>}>
        <AxiomWebVitals />
        <FeatureFlagLoaderUtil />
      </Suspense>
      <Component {...pageProps} />
    </MantineProvider>
  );
};

export default api.withTRPC(MyApp);
