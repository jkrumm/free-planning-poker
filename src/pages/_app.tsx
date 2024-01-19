import React, { Suspense } from 'react';

import { type AppType } from 'next/app';

import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import 'fpp/styles/globals.css';
import { GeistSans } from 'geist/font/sans';
import 'normalize.css/normalize.css';

import { AxiomWebVitals } from 'next-axiom';

import { api } from 'fpp/utils/api';
import { useConfigLoader } from 'fpp/utils/config-loader.hook';

// const theme = createTheme({});

const MyApp: AppType = ({ Component, pageProps: { ...pageProps } }) => {
  useConfigLoader();

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
        <Notifications position="top-right" />
      </Suspense>
      <main className={GeistSans.className}>
        <Component {...pageProps} />
      </main>
    </MantineProvider>
  );
};

export default api.withTRPC(MyApp);
