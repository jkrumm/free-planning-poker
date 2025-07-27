import { Suspense } from 'react';

import { type NextPage } from 'next';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import Contact from 'fpp/components/index/contact';
import Features from 'fpp/components/index/features';
import IndexFormSkeleton from 'fpp/components/index/form-skeleton';
import Privacy from 'fpp/components/index/privacy';
import { Spotlight } from 'fpp/components/index/sportlight';
import Footer from 'fpp/components/layout/footer';
import { Hero } from 'fpp/components/layout/hero';
import { Meta } from 'fpp/components/meta';

const IndexForm = dynamic(() => import('fpp/components/index/form'), {
  ssr: false,
  loading: () => <IndexFormSkeleton />,
});

const Home: NextPage = () => {
  useTrackPageView(RouteType.HOME);

  return (
    <div className="relative h-full w-full antialiased bg-[#1a1b1e] overflow-hidden">
      <div className="absolute inset-0 w-full h-screen bg-grid-white/[0.02] fade-out-to-bottom pointer-events-none" />
      <Meta />
      {/* <Navbar /> */}
      <Hero noMt={true} />
      <main className="flex flex-col items-center justify-center p-6">
        <Spotlight
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(210, 100%, 85%, .04) 0, hsla(210, 100%, 55%, .01) 50%, hsla(210, 100%, 45%, 0) 80%)"
          gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .025) 0, hsla(210, 100%, 55%, .01) 80%, transparent 100%)"
          gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .012) 0, hsla(210, 100%, 45%, .01) 80%, transparent 100%)"
          xOffset={170}
          width={560 * 1.3}
          smallWidth={240 * 1.2}
          height={1380 * 1.3}
          duration={9}
          translateY={-500}
        />
        <Suspense fallback={<IndexFormSkeleton />}>
          <IndexForm />
        </Suspense>
        <div className="gradient-image"></div>
        <div className="z-10 w-[1200px] max-w-full p-6">
          <section id="screenshot">
            <Image
              src="/images/fpp_screenshot.png"
              width={2852 / 2.5}
              height={1586 / 2.5}
              className="h-auto max-w-full rounded-2xl border-[5px] border-solid border-[#b8b8b8] border-opacity-15"
              alt="Picture of the free planning poker app ui"
              placeholder="blur"
              blurDataURL={'/images/fpp_screenshot.png'}
              priority={true}
            />
          </section>
        </div>
        <div className="w-full max-w-[1050px] px-4">
          <Features />
          <Privacy />
          <Contact />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Home;
