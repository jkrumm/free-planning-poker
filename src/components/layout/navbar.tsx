import Link from 'next/link';

import { Button, Group, Text } from '@mantine/core';

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
    title: 'Roadmap',
    href: '/roadmap',
  },
  {
    title: 'Contact',
    href: '/contact',
  },
];

const Navbar = () => {
  return (
    <nav className="hidden md:block sticky top-0 z-50 bg-[#1A1B1E]/30 px-6">
      <div className="mx-auto h-[70px] max-w-[1200px]">
        <Group justify="space-between" h="100%">
          <div className="hidden lg:block w-[177px]">
            <Link href="/">
              <div className="logo-navbar" />
            </Link>
          </div>
          <Group gap={20}>
            {navItems.map((item, index) => (
              <Link
                key={index}
                href={item.href}
                className="no-underline hover:text-[#C1C2C5] focus:text-[#C1C2C5] text-[#C1C2C5]"
              >
                <Text className={`font-bold`}>{item.title}</Text>
              </Link>
            ))}
          </Group>
          <Button
            size="lg"
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
            className={`hidden md:block w-[177px]`}
          >
            Start Planning
          </Button>
        </Group>
      </div>
    </nav>
  );
};

export default Navbar;
