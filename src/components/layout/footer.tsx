import Link from 'next/link';

import { Button } from '@mantine/core';

import { IconArrowUp } from '@tabler/icons-react';

import { useConfigStore } from 'fpp/store/config.store';

const linksRight = [
  {
    url: '/',
    title: 'Home',
  },
  {
    url: '/guide',
    title: 'Guide',
  },
  {
    url: '/analytics',
    title: 'Analytics',
  },
  {
    url: '/roadmap',
    title: 'Roadmap',
  },
  {
    url: '/contact',
    title: 'Contact',
  },
];

const linksCenter = [
  {
    url: '/roadmap',
    title: 'Roadmap',
  },
  {
    url: '/imprint',
    title: 'Imprint & Privacy Policy',
  },
];

function Footer() {
  const latestTag = useConfigStore((state) => state.latestTag);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-[#121314] py-4">
      <div className="mx-auto max-w-[800px] px-4">
        <div className="grid grid-cols-4 md:grid-cols-4 gap-4">
          {/* Left Column */}
          <div className="col-span-4 md:col-span-2 flex flex-col justify-center items-center md:items-start space-y-1">
            <div className="flex items-center space-x-3 text-sm text-[#C1C2C5]">
              <span>© {new Date().getFullYear()}</span>
              <span>•</span>
              <a
                href="https://github.com/jkrumm/free-planning-poker/releases"
                target="_blank"
                className="hover:text-[#1971c2]"
                rel="noopener noreferrer"
              >
                v{latestTag}
              </a>
              <span>•</span>
              <Link href="/imprint#license" className="hover:text-[#1971c2]">
                AGPLv3
              </Link>
            </div>
            <div className="text-sm text-[#C1C2C5]">
              <p>Created by Johannes Krumm</p>
            </div>
            <Button
              onClick={scrollToTop}
              variant="outline"
              size="xs"
              color="grey"
              className="!mt-4"
            >
              <IconArrowUp size={16} className="mr-2" />
              Back to Top
            </Button>
          </div>

          {/* Center Column */}
          <div className="col-span-4 md:col-span-1 flex flex-col justify-center items-center md:items-center">
            <nav className="flex flex-col items-center gap-0.5 text-sm border-0">
              {linksCenter.map((link) => (
                <Link
                  key={link.url}
                  href={link.url}
                  className="text-[#C1C2C5] hover:text-[#1971c2]"
                >
                  {link.title}
                </Link>
              ))}
              <a
                href="https://paypal.me/johanneskrum"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C1C2C5] hover:text-[#1971c2]"
              >
                Donate
              </a>
              <a
                href="https://github.com/jkrumm/free-planning-poker"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C1C2C5] hover:text-[#1971c2]"
              >
                GitHub
              </a>
            </nav>
          </div>

          {/* Right Column */}
          <div className="col-span-4 md:col-span-1 flex flex-col justify-center items-center md:items-end">
            <nav className="flex flex-col items-center gap-0.5 text-sm border-0">
              {linksRight.map((link) => (
                <Link
                  key={link.url}
                  href={link.url}
                  className="text-[#C1C2C5] hover:text-[#1971c2]"
                >
                  {link.title}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
