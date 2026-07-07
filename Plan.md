# The Plan

*How an AI built this website, start to finish - and how a human helped.*

This site was built almost entirely by [Claude Code](https://claude.com/claude-code), Anthropic's coding agent. Not in one heroic session, but as a relay race of many small sessions, each with no memory of the ones before it. This file is the retrospective: what the process was, why it was shaped that way, and what actually happened on the road to production.

## Step 0 - One planning conversation

The project began as a single design conversation with the AI. The output wasn't code - it was a plan: the concept ("the forecast *is* the design"), the stack (Next.js + TypeScript + Tailwind on Vercel), the data sources (Open-Meteo, AirNow), the design principles (no cards, no chrome, honest greys), and a breakdown of the work into **11 tasks (T0-T10)** arranged in a dependency graph. Yes: the AI's first deliverable was a plan for instructing itself. A plan within a plan. We had to go deeper.

## The task DAG

```
T0 (scaffold)
 ├── T1 (forecast service)
 │    ├── T2 (color map)         depends on T1's ForecastResult type
 │    └── T6 (share image)       depends on T1 + T2
 ├── T3 (location search)
 ├── T4 (cloud rendering)
 └── T5 (contrast + fonts)

T7 (main page assembly)          depends on T1, T2, T3, T4, T5
 ├── T8 (3-day preview)          depends on T7
 ├── T9 (grey/edge polish)       depends on T7
 └── T10 (share button + deploy) depends on T6, T7
```

T1-T5 could run in parallel once the scaffold existed. T7 was the integration bottleneck where everything had to click together. The task files themselves are still in [`tasks/`](tasks/) - they're the real historical artifact here.

## The Memento protocol

Here's the core constraint: **each task ran in a fresh AI session that remembered nothing.** No chat history, no context, no "as we discussed earlier." Like Leonard in *Memento*, every session woke up with amnesia and had to work entirely from what was written down.

So everything was written down:

- **Self-contained task files.** Every file under `tasks/` starts with the full shared context - concept, stack, data sources, design principles, target repo structure - inlined at the top. A session could execute T6 without ever reading T1. The task files were the tattoos.
- **A `nextTask` baton.** A small file at the repo root told each new session which task was up next. Finish your task, update the baton, end the session. The last session found the baton pointing at T10 and, per its instructions, left behind a single line: `DONE !!!!`
- **Explicit acceptance criteria.** Every task file ends with concrete, checkable criteria - "the share button on production downloads a PNG that matches the on-screen gradient" - so a session knew when it was *done*, not when it *felt* done. Your task, should you choose to accept it. (No session was given a choice.)

## Trust, but verify (with a robot browser)

Sessions were not allowed to grade their own homework by vibes. The repo carries a project-specific skill ([`.claude/skills/verify/`](.claude/skills/verify/SKILL.md)) that teaches any session how to launch the dev server and drive the real page with Playwright - including how to mock the geocoding and forecast APIs so tests don't depend on the weather (ironic, for a weather site).

The T10 session, for example, verified its own share button by: asserting every meta tag, clicking the button headlessly, checking the download fired with the right query parameters, and separately stubbing the Web Share API to prove the mobile path worked too.

## The deployment saga

The plan called for deploying in T0. Reality called an audible: the code was finished through T10 before the project had ever met git. The final stretch, all AI-driven with a human clicking OAuth prompts:

1. **`git init`** - but first the AI noticed a stray `.env.local.txt` holding the real AirNow key that the default `.gitignore` did *not* cover, and blocked it before the first commit. The secret shall not pass. 🧙
2. **Vercel via CLI** - device-code login (human clicks "Approve", AI does everything else), project linked, `AIRNOW_API_KEY` pushed to Production/Preview/Development through stdin so the value never appeared in any terminal output, then `vercel deploy --prod`.
3. **Live verification** - curl checks on the production URL: meta tags present, share endpoint returns a real PNG, forecast API returns AirNow data, and the key appears in no HTTP response.
4. **GitHub via CLI** - installed `gh`, another device-code dance, public repo created and pushed.
5. **Auto-deploys** - Vercel connected to the GitHub repo, so every push to `master` now deploys itself. The pipeline's first test was the commit that removed the demo pages: pushed, built, live in about 40 seconds, no human hands.

## Division of labor

**The AI wrote:** the plan, the task files, all application code, the color model, the browser tests, the deploy commands, and every word of these docs.

**The human supplied:** the idea, taste-level feedback ("too cluttered", "delete from GitHub, not local"), the AirNow API key, and two OAuth device-code approvals. Also, crucially: the decision that the repo should be public. Great power, great responsibility - that call stays with the person whose name is on the account.

## What the process got right

- **Inlined context beat shared context.** No session ever had to guess what the project was; the answer was always at the top of its own task file.
- **Acceptance criteria beat intentions.** "Stop when the criteria are met" produces a very different session than "do your best".
- **Files beat memory.** Every hand-off that mattered happened on disk - the baton, the skill, the task specs. Anything not written down effectively never happened.
- **The honest-grey principle applied to process too.** When a deploy check failed or a step was skipped (looking at you, T0 deploy), the session's job was to say so plainly and route around it - not to fake a sunset.
