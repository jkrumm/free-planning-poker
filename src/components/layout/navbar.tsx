import { Button, Group, Title } from "@mantine/core";
import Link from "next/link";

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-[#1A1B1E] px-6">
      <div className="mx-auto h-[80px] max-w-[1200px]">
        <Group justify="space-between" h="100%">
          <Link
            href="/"
            className="flex text-[#C1C2C5] no-underline hover:text-[#C1C2C5] focus:text-[#C1C2C5]"
          >
            <div className="logo-navbar" />
            <Title order={1} className="mb-0 ml-3 mr-0 mt-1">
              Free Planning Poker
            </Title>
          </Link>
          <Button
            size="lg"
            variant="gradient"
            gradient={{ from: "blue", to: "cyan" }}
            className={`hidden md:block`}
          >
            Start Planning
          </Button>
        </Group>
      </div>
    </nav>
  );
};

export default Navbar;
