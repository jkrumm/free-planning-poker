/**
 * The Markdown twin of /guide. guide.astro holds the same text as HTML; test/twins.site.test.ts fails when the headings
 * or the description of the two drift apart.
 */
export const guideTwin = {
  title: 'Guide',
  description:
    'Planning poker explained: story points, the Fibonacci sequence, anonymous voting and how to read the estimates.',
  updated: new Date('2026-11-22'),
  body: `# Master the Art of Planning Poker: An Agile Approach to Estimation

## TL;DR

Discover how Planning Poker, an Agile estimation technique, helps teams efficiently plan sprints using story points. Learn about its process, the role of the Fibonacci sequence, and the benefits of anonymity and gamification in achieving accurate task estimations.

## The Essence of Planning Poker

Agile methodologies like **Scrum, Kanban, and Jira** emphasize iterative development and effective task estimation. Planning Poker is a widely used technique that combines **team collaboration, game mechanics**, and the Fibonacci sequence to achieve precise workload estimates.

### Why Sprint Planning Matters

Effective sprint planning ensures productive use of team resources over time. Story points are crucial as they provide a way to measure **team capacity, plan upcoming sprints, and track progress**. They enable tools like Velocity and Burndown charts, helping in comparing team performance and enhancing overall productivity.

### How Planning Poker Works

In Planning Poker, tasks are assigned **Fibonacci numbers** (1, 2, 3, 5, 8, 13, 21) to estimate their complexity and time requirements. This sequence mirrors the uncertainty and risk associated with task estimation. Transforming abstract complexity into numerical values is useful for prioritizing backlog items and rationalizing efforts.

## The Power of Anonymity and Gamification

In Planning Poker, team members vote anonymously, which enhances objectivity and promotes a **diversity of viewpoints**. The integration of gamification increases engagement and ensures that task estimates are **unbiased** and accurate.

## Interpreting Estimations and Splitting Tasks

Once votes are revealed, the highest and lowest estimators explain their reasoning, providing valuable insights into task complexities. Tasks estimated at 13 points or more are typically split into smaller, **more manageable tasks to prevent sprint overload and improve visibility**.

## Insights from Voting Metrics

Key metrics like minimum, maximum, average, and vote count offer valuable insights. A higher average often suggests that teams prefer conservative estimates, helping cushion against unforeseen complexities and ensuring timely sprint completion.

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
`,
}
