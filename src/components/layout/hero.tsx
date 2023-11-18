import { Button, Container, Text } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";

export function Hero(props: { withDescription?: true; full?: true }) {
  const router = useRouter();

  // which page are we on
  const page = router.pathname;

  const onHome = page === "/";
  const onRoadmap = page === "/roadmap";
  const onAnalytics = page === "/analytics";
  const onContact = page === "/contact";
  const onImprint = page === "/imprint";

  return (
    <header>
      <Container size={820} className="pb-7 pt-5 md:pb-10 md:pt-8">
        <Link href="/" className="no-underline">
          <div className="logo" />
          <h1
            className={`center m-0 block p-0 text-center text-[42px] md:text-[62px]`}
          >
            <Text
              component="span"
              variant="gradient"
              gradient={{ from: "blue", to: "cyan" }}
              inherit
              className="mb-4 block"
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
              Fast <span>|</span> Easy <span>|</span> Realtime <span>|</span>{" "}
              Open Source <span>|</span> Privacy Focused
            </h2>
            <nav className="flex flex-col justify-center align-middle md:flex-row md:space-x-4">
              <Link href="/">
                <Button color={onHome ? "dark" : "gray"} variant="outline">
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
                <Button color={onRoadmap ? "dark" : "gray"} variant="outline">
                  Roadmap
                </Button>
              </Link>
              <Link href="/analytics" className="lg:hidden">
                <Button color={onAnalytics ? "dark" : "gray"} variant="outline">
                  Analytics
                </Button>
              </Link>
              <Link href="/contact">
                <Button color={onContact ? "dark" : "gray"} variant="outline">
                  Contact
                </Button>
              </Link>
              <Link href="/imprint" className="lg:hidden">
                <Button color={onImprint ? "dark" : "gray"} variant="outline">
                  Imprint
                </Button>
              </Link>
            </nav>
          </>
        )}
        {props.withDescription && (
          <Text className={`mt-12 text-center text-[22px]`}>
            <p>
              Say goodbye to complicated and expensive planning poker tools with
              this
              <br className="hidden md:block" />
              user-friendly app. Based on the Fibonacci sequence for story point
              estimation,
              <br className="hidden md:block" />
              this tool is suitable for any agile project management needs,
              whether you use Scrum, Kanban, or your own custom Jira workflow.
            </p>
          </Text>
        )}
      </Container>
    </header>
  );
}
