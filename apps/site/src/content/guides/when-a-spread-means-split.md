---
title: When does a spread in planning poker mean the story should be split?
description: "A wide spread is information, not a failure. Three signs that a story should be split instead of voted on again, and what Free Planning Poker shows at the reveal."
published: 2026-11-22
updated: 2026-11-22
draft: true
questions:
  - question: What does the room mean by split?
    answer: "A split round is one where the cards are further apart than neighbouring cards of the deck. The result then names the lowest and the highest seat, for example \"Spread 3 to 13. Anna voted lowest, Ben highest.\" It is a description of the votes. Whether the story should be split is the team's decision."
  - question: How many re-votes are too many?
    answer: "Mountain Goat Software says one to three rounds is usually enough. A team that is still apart after that has a story that needs clarifying, splitting or a decision from the product owner."
  - question: Should we settle on the average?
    answer: "No. Mountain Goat Software calls averaging tempting because it looks efficient, and advises treating disagreement as information. The room shows the average only for numeric decks, and smaller than the other figures."
  - question: Who explains first when the cards differ?
    answer: "The two people who played the lowest and the highest card. The room names both of them in the result. The high estimate often points at hidden work or risk, and the low one at a shortcut the others did not see."
  - question: What if the spread is only two neighbouring cards?
    answer: "The room calls that near consensus. Mountain Goat Software says a team does not need perfect agreement, it needs enough to support the decision the estimate is for. The team then settles a final value from the distribution bar, or votes again."
---

When should a team split a story instead of voting on it again? Split it when the spread is still open after one to three rounds, when the lowest and the highest voter describe different amounts of work, or when the estimate lands above the largest size your team commits to. Clarifying the story and asking the product owner to decide are the other ways out of a stuck round.

## What the room shows at the reveal

After the flip the cards sort into columns by value, and a summary line says which of three things happened:

- **Consensus.** Every card is the same. That value is the topic's final value at once, and the room celebrates.
- **Near consensus.** The cards are only on neighbouring positions of the deck.
- **Split.** The cards are further apart. The line names the lowest and the highest seat: "Spread 3 to 13. Anna voted lowest, Ben highest."

Distance is measured in deck positions, so the rules work the same for T-shirt sizes and for numbers. The result also shows the median and the most common value. The average is shown only for numeric decks, and smaller than the other figures.

The distribution bar doubles as the decision. The card closest to the middle is marked as the suggestion, and a click on any bar settles the final value. The other action is a re-vote, which keeps the topic and clears the cards. The final value appears in the topic list and can be corrected there.

## Three signs that the story is too big

**The two ends explain different work.** Mountain Goat Software tells teams to start with the high and the low estimates, and notes that the high estimate often reveals hidden work, risk or complexity, while the low one can be just as useful ([Mountain Goat Software](https://www.mountaingoatsoftware.com/agile/story-points/planning-poker)). If the explanation of the highest card is a part of the story the lowest card did not include, the story probably holds two. Atlassian gives the same advice: ask both to explain, because the person with the high estimate may have found complexity others missed, and the person with the low estimate may know a shortcut ([Atlassian](https://www.atlassian.com/agile/project-management/fibonacci-story-points)).

**The votes do not converge.** Mountain Goat Software says one to three rounds are usually enough, and that more often means the item needs clarification, splitting or a decision from the product owner ([Mountain Goat Software](https://www.mountaingoatsoftware.com/agile/story-points/planning-poker)). A re-vote is cheap in the room. A topic that still has no agreement after the third round is the signal.

**The estimate is above your ceiling.** Atlassian recommends that no individual task is more than 16 hours of work, or about 20 points if you use story points, and says an item above that limit is a signal to break it down and re-estimate ([Atlassian](https://www.atlassian.com/agile/project-management/estimation)). The Scrum Guide describes the same step as refinement: breaking items down into smaller, more precise ones, which the developers who do the work size ([Scrum Guide](https://scrumguides.org/scrum-guide.html)). Set your own ceiling, then treat an estimate above it as a reason to split.

## After the decision

If the story is split, type or paste the smaller stories into the room as topics, one per line, and estimate them one by one. If it stays whole, settle a value from the distribution bar. Do not reach for the average: Mountain Goat Software calls it tempting because it looks efficient, and advises treating disagreement as information, not as a problem to remove ([Mountain Goat Software](https://www.mountaingoatsoftware.com/agile/story-points/planning-poker)).

## Sources

Read on 2026-11-22.

- [Mountain Goat Software: Planning Poker](https://www.mountaingoatsoftware.com/agile/story-points/planning-poker)
- [Atlassian: Fibonacci story points](https://www.atlassian.com/agile/project-management/fibonacci-story-points)
- [Atlassian: Estimation and story points](https://www.atlassian.com/agile/project-management/estimation)
- [The Scrum Guide (2020)](https://scrumguides.org/scrum-guide.html)
