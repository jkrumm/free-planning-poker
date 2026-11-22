---
title: Which planning poker deck should a team use?
description: "Fibonacci, modified Fibonacci, T-shirt sizes, powers of two or your own values: what each deck is for, and how the decks in Free Planning Poker relate to each other."
published: 2026-11-22
updated: 2026-11-22
draft: true
questions:
  - question: Which deck should a new team start with?
    answer: "Fibonacci, the default in the room. Change the deck when the work asks for it, for example to T-shirt sizes for a first rough pass over a backlog."
  - question: Why not use every number from 1 to 13?
    answer: "Because the team then argues about small differences that do not matter for planning. Atlassian describes the gaps of the Fibonacci numbers as the remedy: the choice is between 5 and 8, which keeps the team on the bigger picture."
  - question: Can a team switch from T-shirt sizes to numbers?
    answer: "Yes. In the room every card carries a number behind its label, and T-shirt sizes map onto the Fibonacci numbers, so history and statistics compare across decks. Treat the mapped number as a rough band, and vote again with numbers on the stories you are about to commit to."
  - question: What does the ? card mean?
    answer: "In the room it abstains. Agree on one meaning with your team before the first round: see the section on the ? and the break card."
  - question: Can a team use its own values?
    answer: "Yes, the room supports custom values. Keep the list short and make sure everyone can say what the smallest and the largest value stand for."
---

Which deck should your team estimate with? Use Fibonacci until you have a reason to change. Use T-shirt sizes when you need a quick, rough pass over work nobody has sized yet, and switch to numbers for the stories you are about to commit to.

## The decks in the room

Free Planning Poker has five kinds of deck:

| Deck | What it is |
|-|-|
| Fibonacci | The default |
| Modified Fibonacci | A variation on Fibonacci |
| T-shirt | Sizes instead of numbers |
| Powers of two | Each value twice the one before |
| Custom | Values the team sets |

Three facts about all of them:

- Every deck has a `?` card and a break card.
- Every card carries a number behind its label, and T-shirt sizes map onto the Fibonacci numbers. That is how a team's history and statistics compare across decks.
- The reveal measures the distance between two cards in deck positions, not in numbers. The same rules for consensus and near consensus work for T-shirt sizes and for numbers.

## Which deck for which work

**Fibonacci.** The gaps between the numbers grow, as the uncertainty of the work does: the difference between 1 and 2 is small, the jump from 13 to 21 is large. A team that cannot play a 6 or a 7 does not argue about the difference and picks 5 or 8 ([Atlassian](https://www.atlassian.com/agile/project-management/fibonacci-story-points)). Doubling would claim too much precision: a task of about twice the effort of a 5 is either a bit less than double (8) or a bit more (13), and "exactly double" would be misleadingly precise ([Wikipedia](https://en.wikipedia.org/wiki/Planning_poker)).

**Modified Fibonacci.** Mountain Goat Software describes a typical deck as 0, 1, 2, 3, 5, 8, 13, 20, 40 and 100 ([Mountain Goat Software](https://www.mountaingoatsoftware.com/agile/story-points/planning-poker)). Past 13 the values are rounded: a team that plays 21 claims more precision than an estimate of such a large item has ([Wikipedia](https://en.wikipedia.org/wiki/Planning_poker)). Use it when large items are part of the session.

**T-shirt sizes.** TeamRetro puts the position plainly: T-shirt sizing is for shape and speed, not for sprint commitment ([TeamRetro](https://www.teamretro.com/guides/agile-estimation-guide/t-shirt-sizing/)). Reach for it when the work is early and rough: a backlog nobody has sized, a roadmap, a first pass to find the items that are clearly too big. Agree on a reference small and a reference large first, or the sizes drift. TeamRetro also points out that sizes do not add up (an S plus an M is not an L), so they give no velocity, which story points do. Re-estimate the near-term stories with numbers.

**Powers of two.** Wikipedia lists decks with a fixed ratio between the values, such as 1, 2, 4, 8, next to Fibonacci ([Wikipedia](https://en.wikipedia.org/wiki/Planning_poker)). They have the same wide gaps and a steeper climb. The same page argues for Fibonacci over simple doubling, so choose powers of two for a reason your team can state.

**Custom values.** The room takes the values you give it. Whatever you choose, the team needs the same idea of what each value stands for. Atlassian suggests a check: pull up the last five stories the team delivered with the same value and discuss whether their effort was similar ([Atlassian](https://www.atlassian.com/agile/project-management/estimation)).

## The ? and the break card

Mountain Goat Software reads the cards like this ([Mountain Goat Software](https://www.mountaingoatsoftware.com/agile/story-points/planning-poker)):

- A question mark: "I do not understand this well enough to estimate."
- A very large value or an infinity card: "this is too big to estimate usefully right now."
- A coffee card: the team needs a break.

In the room the `?` card abstains and a break card is available in each deck. Decide as a team what a `?` triggers: a clarifying question to the product owner is a common answer.

## Sources

Read on 2026-11-22.

- [Mountain Goat Software: Planning Poker](https://www.mountaingoatsoftware.com/agile/story-points/planning-poker)
- [Atlassian: Fibonacci story points](https://www.atlassian.com/agile/project-management/fibonacci-story-points)
- [Atlassian: Estimation and story points](https://www.atlassian.com/agile/project-management/estimation)
- [TeamRetro: T-shirt sizing](https://www.teamretro.com/guides/agile-estimation-guide/t-shirt-sizing/)
- [Wikipedia: Planning poker](https://en.wikipedia.org/wiki/Planning_poker)
