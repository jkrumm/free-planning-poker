import React, { Suspense } from 'react';

import { type AppType } from 'next/app';

import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import 'fpp/styles/global.scss';
import 'fpp/styles/index.scss';
import 'fpp/styles/room.scss';
import 'normalize.css/normalize.css';

import { api } from 'fpp/utils/api';

import { useConfigLoader } from 'fpp/hooks/config-loader.hook';

import Footer from 'fpp/components/layout/footer';

const MyApp: AppType = ({ Component, pageProps: { ...pageProps } }) => {
  useConfigLoader();

  return (
    <MantineProvider defaultColorScheme="dark">
      <Suspense fallback={<></>}>
        <Notifications position="top-right" />
      </Suspense>
      <main>
        <Component {...pageProps} />
      </main>
      <Footer />
    </MantineProvider>
  );
};

export default api.withTRPC(MyApp);
