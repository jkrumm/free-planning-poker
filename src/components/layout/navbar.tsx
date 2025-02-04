import Link from 'next/link';

import { Text } from '@mantine/core';

const navItems = [
  {
    title: 'Home',
    href: '/',
  },
  {
    title: 'Guide',
    href: '/guide',
  },
  {
    title: 'Analytics',
    href: '/analytics',
  },
  {
    title: 'Contact',
    href: '/contact',
  },
];

const Navbar = (props: { animate?: boolean }) => {
  return (
    <nav
      className={`${props.animate ? 'animate-fadeIn opacity-0' : ''} fixed w-screen top-0 z-50 bg-[#1A1B1E]/30 px-6`}
      style={{ animationDelay: `2000ms` }}
    >
      <div className="mx-auto h-[70px] max-w-[1200px] flex justify-center">
        <div className="flex mt-6 gap-7 md:gap-11">
          {navItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              className="no-underline hover:text-[#C1C2C5] focus:text-[#C1C2C5] text-[#C1C2C5]"
            >
              <Text className={`font-bold`}>{item.title}</Text>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
