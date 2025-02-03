import Link from 'next/link';
import { useRouter } from 'next/router';

import { Button, Container, Text } from '@mantine/core';

export function Hero(props: { animate?: boolean; full?: true }) {
  const router = useRouter();

  // which page are we on
  const page = router.pathname;

  const onHome = page === '/';
  const onRoadmap = page === '/roadmap';
  const onAnalytics = page === '/analytics';
  const onContact = page === '/contact';
  const onImprint = page === '/imprint';

  return (
    <header>
      <Container
        size={820}
        className={`mb-5 mt-20 pt-5 md:mb-7 md:pt-7 ${props.animate ? 'animate-fadeInUp' : ''}`}
      >
        <Link href="/" className="no-underline">
          <div className="logo" />
          <h1
            className={`center m-0 block p-0 text-center text-[42px] md:text-[62px]`}
          >
            <Text
              component="span"
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              inherit
              className="mb-3 block"
            >
              Free-Planning-Poker.com
            </Text>
          </h1>
        </Link>
        {props.full && (
          <>
            <h2
              className={`mb-12 mt-0 hidden text-center text-[18px] opacity-80 md:block md:text-[24px]`}
            >
              Fast <span>|</span> Easy <span>|</span> Realtime <span>|</span>{' '}
              Open Source <span>|</span> Privacy Focused
            </h2>
            <nav className="flex flex-col justify-center align-middle md:flex-row md:space-x-4">
              <Link href="/">
                <Button color={onHome ? 'dark' : 'gray'} variant="outline">
                  Home
                </Button>
              </Link>
              <a
                href="https://paypal.me/johanneskrum"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button color="gray" variant="outline">
                  Donate
                </Button>
              </a>
              <a
                href="https://github.com/jkrumm/free-planning-poker"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" color="gray">
                  GitHub
                </Button>
              </a>
              <Link href="/roadmap">
                <Button color={onRoadmap ? 'dark' : 'gray'} variant="outline">
                  Roadmap
                </Button>
              </Link>
              <Link href="/analytics" className="lg:hidden">
                <Button color={onAnalytics ? 'dark' : 'gray'} variant="outline">
                  Analytics
                </Button>
              </Link>
              <Link href="/contact">
                <Button color={onContact ? 'dark' : 'gray'} variant="outline">
                  Contact
                </Button>
              </Link>
              <Link href="/imprint" className="lg:hidden">
                <Button color={onImprint ? 'dark' : 'gray'} variant="outline">
                  Imprint
                </Button>
              </Link>
            </nav>
          </>
        )}
      </Container>
    </header>
  );
}
