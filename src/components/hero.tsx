import { Container, createStyles, MantineTheme, Text } from "@mantine/core";
// import { GithubIcon } from "@mantine/ds";

const BREAKPOINT = "@media (max-width: 755px)";

const useStyles = createStyles((theme: MantineTheme) => ({
  wrapper: {
    position: "relative",
    boxSizing: "border-box",
  },

  inner: {
    position: "relative",
    paddingTop: 80,
    paddingBottom: 80,

    [BREAKPOINT]: {
      paddingBottom: 60,
      paddingTop: 50,
    },
  },

  title: {
    fontFamily: `Greycliff CF, ${theme.fontFamily || ""}`,
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
    marginTop: theme.spacing.xl,
    fontSize: 24,

    [BREAKPOINT]: {
      fontSize: 18,
    },
  },
}));

export function Hero() {
  const { classes } = useStyles();

  return (
    <div className={classes.wrapper}>
      <Container size={820} className={classes.inner}>
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
        <h2 className="mb-12 text-center">
          Fast <span>|</span> Easy <span>|</span> Realtime <span>|</span> Open
          Source <span>|</span> Privacy Focused
        </h2>
        <Text className={`${classes.description} text-center`} color="dimmed">
          Say goodbye to overly complicated and costly planning poker tools with
          this user-friendly app. Based on the Fibonacci sequence for story
          point estimation, this tool is suitable for any agile project
          management needs, whether you use Scrum, Kanban, or your own custom
          Jira workflow.
        </Text>
      </Container>
    </div>
  );
}
