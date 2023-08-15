import { type AppType } from "next/app";

import { api } from "fpp/utils/api";

import "fpp/styles/globals.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import React from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals as useNextReportWebVitals } from "next/dist/client/web-vitals";
import { reportWebVitalsWithPath } from "next-axiom/src/webVitals/webVitals";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export { reportWebVitals } from "next-axiom";

const MyApp: AppType = ({ Component, pageProps: { ...pageProps } }) => {
  const pathName = usePathname();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  useNextReportWebVitals((metric) => reportWebVitalsWithPath(metric, pathName));

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
