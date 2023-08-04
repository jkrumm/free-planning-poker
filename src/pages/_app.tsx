import { type AppType } from "next/app";

import { api } from "fpp/utils/api";

import "fpp/styles/globals.css";
import { MantineProvider } from "@mantine/core";
import PlausibleProvider from "next-plausible";
import { Notifications } from "@mantine/notifications";

const MyApp: AppType = ({ Component, pageProps: { ...pageProps } }) => {
  return (
    <PlausibleProvider domain={"free-planning-poker.com"}>
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
    </PlausibleProvider>
  );
};

export default api.withTRPC(MyApp);
