import React from 'react';

import Link from 'next/link';

import { Button } from '@mantine/core';

import { Hero } from 'fpp/components/layout/hero';
import Navbar from 'fpp/components/layout/navbar';
import { Meta } from 'fpp/components/meta';

export default function Custom404() {
  return (
    <>
      <Meta title="Imprint & Privacy Policy" />
      <Navbar />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container max-w-[1200px] gap-12 px-4 pb-28 pt-8 md:flex">
          <div className="flex flex-col items-center justify-center w-full">
            <h1 className="text-4xl font-bold text-center">
              404 - Page Not Found
            </h1>
            <p className="mt-4 text-center">
              The page you are looking for does not exist. Please go back to the
              homepage.
            </p>
            <Link href="/">
              <Button className="mt-4">Back to homepage</Button>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
