import React from 'react';

import { type AppType } from 'next/app';
import { Inter, JetBrains_Mono, Manrope } from 'next/font/google';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import 'normalize.css/normalize.css';

import 'fpp/styles/global.css';
import 'fpp/styles/index.css';
import 'fpp/styles/room.css';

import 'fpp/utils/ag-charts-init';
import { api } from 'fpp/utils/api';

import { useConfigLoader } from 'fpp/hooks/config-loader.hook';

import { ErrorBoundary } from 'fpp/components/room/error-boundry';

// Load fonts with next/font for zero FOUC
// font-display: block makes browser wait for font before rendering
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-inter',
  display: 'block', // Critical: blocks render until font loads
  preload: true,
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-manrope',
  display: 'block', // Critical: blocks render until font loads
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-jetbrains-mono',
  display: 'block', // Critical: blocks render until font loads
  preload: true,
});

const MyApp: AppType = ({ Component, pageProps: { ...pageProps } }) => {
  useConfigLoader();

  return (
    <div
      className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <MantineProvider
        defaultColorScheme="dark"
        theme={{
          fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
          fontFamilyMonospace:
            'var(--font-jetbrains-mono), ui-monospace, monospace',
          headings: {
            fontFamily:
              'var(--font-manrope), ui-sans-serif, system-ui, sans-serif',
          },
        }}
      >
        <Notifications position="top-right" />
        <main>
          <ErrorBoundary componentName="App">
            <Component {...pageProps} />
          </ErrorBoundary>
        </main>
      </MantineProvider>
    </div>
  );
};

export default api.withTRPC(MyApp);
