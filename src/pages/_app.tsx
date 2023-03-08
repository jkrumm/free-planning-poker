import { type AppType } from "next/app";
// import { type Session } from "next-auth";
import { api } from "~/utils/api";

import "~/styles/globals.css";
import { MantineProvider } from "@mantine/core";
import PlausibleProvider from "next-plausible";
import { Notifications } from "@mantine/notifications";

// const MyApp: AppType<{ session: Session | null }> = ({
const MyApp: AppType = ({ Component, pageProps: { ...pageProps } }) => {
  return (
    <PlausibleProvider domain={"free-planning-poker.com"}>
      <MantineProvider
        withNormalizeCSS
        withGlobalStyles
        theme={{
          colorScheme: "dark",
        }}
      >
        {/*<SessionProvider session={session}>*/}
        <Notifications position="top-right" />
        <Component {...pageProps} />
        {/*</SessionProvider>*/}
      </MantineProvider>
    </PlausibleProvider>
  );
};

export default api.withTRPC(MyApp);
