import {
  Button,
  Container,
  createStyles,
  type MantineTheme,
  Text,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";

const BREAKPOINT = "@media (max-width: 755px)";

const useStyles = createStyles((theme: MantineTheme) => ({
  wrapper: {
    position: "relative",
    boxSizing: "border-box",
  },

  inner: {
    position: "relative",
    paddingTop: 40,
    paddingBottom: 50,

    [BREAKPOINT]: {
      paddingBottom: 40,
      paddingTop: 20,
    },
  },

  title: {
    fontFamily: `Greycliff CF, ${theme.fontFamily ?? ""}`,
    fontSize: 62,
    fontWeight: 900,
    lineHeight: 1.1,
    margin: 0,
    padding: 0,
    color: theme.colorScheme === "dark" ? theme.white : theme.black,

    [BREAKPOINT]: {
      fontSize: 42,
      lineHeight: 1.2,
    },
  },

  description: {
    fontSize: 24,

    [BREAKPOINT]: {
      fontSize: 18,
    },
  },
}));

export function Hero() {
  const router = useRouter();

  // which page are we on
  const page = router.pathname;

  const onHome = page === "/";
  const onContact = page === "/contact";

  const { classes } = useStyles();

  return (
    <header className={classes.wrapper}>
      <Container size={820} className={classes.inner}>
        <Link href="/" className="no-underline">
          <div className="logo" />
          <h1 className={`${classes.title} mb-7 block`}>
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
        <h2 className="mb-12 text-center opacity-80">
          Fast <span>|</span> Easy <span>|</span> Realtime <span>|</span> Open
          Source <span>|</span> Privacy Focused
        </h2>
        <nav className="flex justify-center space-x-4">
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
          <Link href="/contact">
            <Button color={onContact ? "dark" : "gray"} variant="outline">
              Contact
            </Button>
          </Link>
        </nav>
        {onHome && (
          <Text
            className={`${classes.description} mt-12 text-center`}
            color="dimmed"
          >
            <p>
              Say goodbye to complicated and expensive planning poker tools with
              this user-friendly app. Based on the Fibonacci sequence for story
              point estimation, this tool is suitable for any agile project
              management needs, whether you use Scrum, Kanban, or your own
              custom Jira workflow.
            </p>
          </Text>
        )}
      </Container>
    </header>
  );
}
