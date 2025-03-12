import Link from 'next/link';

import { Container } from '@mantine/core';

export function Hero() {
  return (
    <header>
      <Container size={850} className="mb-5 mt-20 pt-5 md:mb-7 md:pt-7">
        <Link href="/" className="no-underline">
          <div className="logo" />
          <h1
            className={`center m-0 block p-0 text-center text-[45px] md:text-[67px] h-[85px] bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50`}
          >
            Free-Planning-Poker.com
          </h1>
        </Link>
      </Container>
    </header>
  );
}
