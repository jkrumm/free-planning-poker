import Link from "next/link";

const links = [
  {
    url: "/imprint",
    title: "Imprint & Privacy Policy",
  },
  {
    url: "/contact",
    title: "Contact",
  },
];

export function Footer() {
  return (
    <footer>
      <div className="pointer-events-none fixed bottom-0 block min-h-[30px] min-w-full bg-[#121314]" />
      <div className="fixed bottom-0 flex h-[30px] w-full flex-row  bg-[#121314] px-4 py-2 text-xs opacity-40 transition-opacity hover:opacity-100">
        <div className="flex w-1/2 flex-row">
          © {new Date().getFullYear()} Johannes Krumm{" "}
          <Link
            href="/"
            className="pl-3 pr-0.5 text-[#C1C2C5] no-underline visited:text-[#C1C2C5] hover:text-[#1971c2]"
          >
            free-planning-poker.com
          </Link>{" "}
          is licensed under{" "}
          <Link
            href="/imprint#license"
            className="pl-0.5 text-[#C1C2C5] no-underline visited:text-[#C1C2C5] hover:text-[#1971c2]"
          >
            AGPLv3
          </Link>
        </div>
        <div className="flex w-1/2 flex-row items-end justify-end">
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
          {links.map((link) => (
            <Link
              href={link.url}
              key={link.url}
              className="pl-4 text-[#C1C2C5] no-underline visited:text-[#C1C2C5] hover:text-[#1971c2]"
            >
              {link.title}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
