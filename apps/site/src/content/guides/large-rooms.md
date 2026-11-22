---
title: How do you run planning poker with 10 to 30 people?
description: "One room holds up to 30 players. What Free Planning Poker does with that many seats, and how to run the session so the group does not wait on one person."
published: 2026-11-22
updated: 2026-11-22
draft: true
questions:
  - question: How many people can join one room?
    answer: "Up to 30 players. Spectators watch from a rail beside the table and never block a reveal."
  - question: Should all 30 people vote?
    answer: "Not necessarily. Mountain Goat Software says the people who will do the work should estimate, and that everyone on the team takes part in the discussion of every estimate, even without a card. In the room, the others can join as spectators."
  - question: What happens when someone steps away?
    answer: "A seat whose browser tab has been hidden for 30 seconds is dimmed, and it does not block auto reveal. An away seat that has already voted keeps its face-down card."
  - question: Table or grid?
    answer: "The room picks for you. The grid replaces the ring of seats when the room has 25 or more players or the container is under 700 px wide, and a Table/Grid switch overrides the automatic choice."
  - question: Who presses reveal?
    answer: "Anyone. A room has no owner, and every player may reveal, settle and move on. Agree before the session who does it, usually the person who leads the session."
---

How do you run a planning poker session with 10 to 30 people? Split the group into teams of about ten or fewer where you can, and let each team estimate its own work. Where the whole group has to estimate together, one room takes up to 30 players, and an absent person does not hold up auto reveal.

## Before you open the room

**Split first, if the work allows it.** The Scrum Guide describes a Scrum Team as "typically 10 or fewer people" and says smaller teams communicate better and are more productive. A team that grows too large should reorganize into several teams that share one product goal, one product backlog and one product owner ([Scrum Guide](https://scrumguides.org/scrum-guide.html)). A group of 25 is well above that size, so consider letting each team estimate the items it will build.

**Let the people who do the work estimate.** Mountain Goat Software calls it a well-established practice that those who will do the work estimate it, and adds that the whole team should join the discussion of every estimate, even where a member does not hold a card ([Mountain Goat Software](https://www.mountaingoatsoftware.com/agile/why-the-whole-team-should-participate-when-estimating)). The product owner describes each item and answers questions, and generally does not hold up cards. The Scrum Master leads the session ([Mountain Goat Software](https://www.mountaingoatsoftware.com/agile/3-roles-that-need-to-be-involved-in-agile-estimating-with-planning-poker)). In a large room that can mean a few card holders and many spectators. The room supports it: spectators sit in a rail beside the table and never block a reveal.

**Pick the person who presses reveal.** A room has no owner. Every player may reveal, settle a final value, move on, change the settings, remove someone and lock the room. The room keeps v1's rule, which assumes a small team that trusts itself. In a group of 30, name one person who reveals before you start.

**Lock the room if the link will travel.** A room can be locked with a password. From then on the invite link carries the password, so whoever has the link is in, and whoever has only the number is asked for it once.

## What the room does at 10 to 30 seats

The layout follows the width of the room container. Seat size steps down at 9 and at 17 players. The grid replaces the ring of seats when the container is under 700 px wide or the room has 25 or more players. A Table/Grid switch overrides the automatic choice. Seats are spaced by arc length around the table edge, and you always sit at the bottom centre.

The round bar shows "7 of 9 voted". After 20 seconds it names who is missing, and any player can poke them. A seat whose tab has been hidden for 30 seconds is dimmed and does not block auto reveal. Auto reveal starts a three-second ring when the last active player has voted, and any player can cancel it. Because auto reveal ignores away seats, one absent person never stalls 29.

## Keeping the pace

Atlassian advises a couple of minutes at most to understand the reasons behind different estimates. Estimation is a high-level activity: if the team is too far into the details, step back ([Atlassian](https://www.atlassian.com/agile/project-management/estimation)). With 30 people that matters more. The room has an optional countdown of 30, 60 or 120 seconds as a ring on the round bar. When it runs out with auto reveal off, nothing happens. With auto reveal on, it starts the same cancellable three-second ring as the last vote does.

When the cards differ, hear the lowest and the highest first, as Mountain Goat Software recommends ([Mountain Goat Software](https://www.mountaingoatsoftware.com/agile/why-the-whole-team-should-participate-when-estimating)). At the end of the session the summary lists every topic with its final value, spread, number of rounds and duration, with copy as Markdown and export as CSV.

## Sources

Read on 2026-11-22.

- [The Scrum Guide (2020)](https://scrumguides.org/scrum-guide.html)
- [Mountain Goat Software: Why the whole team should participate when estimating](https://www.mountaingoatsoftware.com/agile/why-the-whole-team-should-participate-when-estimating)
- [Mountain Goat Software: Roles involved in estimating with Planning Poker](https://www.mountaingoatsoftware.com/agile/3-roles-that-need-to-be-involved-in-agile-estimating-with-planning-poker)
- [Atlassian: Estimation and story points](https://www.atlassian.com/agile/project-management/estimation)
