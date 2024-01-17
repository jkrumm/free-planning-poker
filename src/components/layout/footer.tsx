import Link from 'next/link';

const links = [
  {
    url: '/analytics',
    title: 'Analytics',
  },
  {
    url: '/contact',
    title: 'Contact',
  },
  {
    url: '/imprint',
    title: 'Imprint & Privacy Policy',
  },
];

export function Footer() {
  return (
    <footer>
      <div className="pointer-events-none fixed bottom-0 z-40 block min-h-[50px] min-w-full bg-[#121314] sm:min-h-[30px]" />
      <div className="fixed bottom-0 z-50 h-[50px] w-full flex-row bg-[#121314] px-4 py-2 text-xs opacity-40 transition-opacity hover:opacity-100 sm:h-[30px] lg:flex">
        <div className="xs:flex w-full flex-row lg:w-1/2">
          © {new Date().getFullYear()}{' '}
          <Link
            href="/"
            className="pr-0.5 text-[#C1C2C5] no-underline visited:text-[#C1C2C5] hover:text-[#1971c2]"
          >
            free-planning-poker.com
          </Link>{' '}
          is licensed under{' '}
          <Link
            href="/imprint#license"
            className="pl-0.5 text-[#C1C2C5] no-underline visited:text-[#C1C2C5] hover:text-[#1971c2]"
          >
            AGPLv3
          </Link>
        </div>
        <div className="hidden w-1/2 flex-row items-end justify-end lg:flex ">
          {links.map((link) => (
            <Link
              href={link.url}
              key={link.url}
              className="pl-4 text-[#C1C2C5] no-underline visited:text-[#C1C2C5] hover:text-[#1971c2]"
            >
              {link.title}
            </Link>
          ))}
          <a
            href="https://paypal.me/johanneskrum"
            target="_blank"
            rel="noopener noreferrer"
            className="pl-4 text-[#C1C2C5] no-underline visited:text-[#C1C2C5] hover:text-[#1971c2]"
          >
            Donate
          </a>
          <a
            href="https://github.com/jkrumm/free-planning-poker"
            target="_blank"
            className="pl-4 text-[#C1C2C5] no-underline visited:text-[#C1C2C5] hover:text-[#1971c2]"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
