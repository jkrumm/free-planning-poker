import { type AppType } from "next/app";

import { api } from "fpp/utils/api";

import "fpp/styles/globals.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import React from "react";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export { reportWebVitals } from "next-axiom";

const MyApp: AppType = ({ Component, pageProps: { ...pageProps } }) => {
  return (
    <MantineProvider
      withNormalizeCSS
      theme={{
        colorScheme: "dark",
      }}
      withGlobalStyles
    >
      <Notifications position="top-right" />
      <Component {...pageProps} />
    </MantineProvider>
  );
};

export default api.withTRPC(MyApp);
