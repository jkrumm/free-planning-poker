---
title: Guide
description: "Planning poker explained: story points, the Fibonacci sequence, anonymous voting and how to read the estimates."
published: 2026-11-22
questions:
  - question: What is planning poker?
    answer: "Planning poker is a way for a team to estimate work together. Everyone picks a card in private, the cards are revealed at the same moment, and the team talks about the gap between the lowest and the highest card before it settles on one value."
  - question: Why do the cards follow the Fibonacci sequence?
    answer: "The gaps between the numbers grow with the size of the work, as the uncertainty does. Nobody has to argue whether a story is a 6 or a 7: the choice is 5 or 8. Free Planning Poker also has a modified Fibonacci deck, T-shirt sizes, powers of two and custom values."
  - question: What should we do when the votes are far apart?
    answer: "Ask the people who played the lowest and the highest card to explain their reasoning, then vote again. The room names both of them in the result."
  - question: When is a story too big to estimate?
    answer: "A common rule of thumb is a story of 13 points or more. Such a story is split into smaller ones before it enters a sprint."
  - question: Does everyone need an account to estimate?
    answer: "No. Open a room, share the link and estimate. There is no account, no sign-up and no cookie banner."
---

# Master the Art of Planning Poker: An Agile Approach to Estimation

## TL;DR

Discover how Planning Poker, an Agile estimation technique, helps teams efficiently plan sprints using story points. Learn about its process, the role of the Fibonacci sequence, and the benefits of anonymity and gamification in achieving accurate task estimations.

## The Essence of Planning Poker

Agile methodologies like **Scrum, Kanban, and Jira** emphasize iterative development and effective task estimation. Planning Poker is a widely used technique that combines **team collaboration, game mechanics**, and the Fibonacci sequence to achieve precise workload estimates.

### Why Sprint Planning Matters

Effective sprint planning ensures productive use of team resources over time. Story points are crucial as they provide a way to measure **team capacity, plan upcoming sprints, and track progress**. They enable tools like Velocity and Burndown charts, helping in comparing team performance and enhancing overall productivity.

### How Planning Poker Works

In Planning Poker, tasks are assigned numbers from a deck of cards to estimate their complexity and time requirements. The default deck is the **Fibonacci numbers** (1, 2, 3, 5, 8, 13, 21). This sequence mirrors the uncertainty and risk associated with task estimation. Transforming abstract complexity into numerical values is useful for prioritizing backlog items and rationalizing efforts.

Fibonacci is the default, not the only deck. The room also offers a modified Fibonacci deck, T-shirt sizes, powers of two and custom values, and each deck has a `?` card to abstain and a break card.

## The Power of Anonymity and Gamification

In Planning Poker, team members vote anonymously, which enhances objectivity and promotes a **diversity of viewpoints**. The integration of gamification increases engagement and ensures that task estimates are **unbiased** and accurate.

## Interpreting Estimations and Splitting Tasks

Once votes are revealed, the room leads with the spread: the lowest and the highest card, and the names of the two people who played them. Those two explain their reasoning, which gives the team valuable insight into the complexity of the task. Tasks estimated at 13 points or more are typically split into smaller, **more manageable tasks to prevent sprint overload and improve visibility**.

## Insights from Voting Metrics

After the spread, the result shows the median and the most common value. The average appears only for numeric decks, and smaller than the other figures, because one number hides how far apart the votes were. Read the spread first, then the median.

## Fibonacci Sequence for Task Estimation: A Quick Guide

| Story Points | Description | Completion Time |
|-|-|-|
| 1 | Straightforward task, requiring adjustments at few places | Max. 1h |
| 2 | Straightforward task, requires more work in implementation, increased documentation or information requirement | 2-4h |
| 3 | Simple task with high effort or a complex task with clear steps | 4-8h |
| 5 | Complex task with unclear implementation | 8-16h |
| 8 | Very complex task with significant uncertainty | 16-32h |
| 13 | Extremely complex task with very high effort | At least one week |

Embrace collective intelligence, gamification, and the Fibonacci sequence with Planning Poker to set your Agile projects on the path to success.
