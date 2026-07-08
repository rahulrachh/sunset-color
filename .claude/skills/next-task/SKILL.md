---
name: next-task
description: Execute the next queued task from the nextTask pointer file - implements the referenced tasks/T<n>.md, verifies it, reports frontend-visible changes, and advances the queue.
---

# next-task

Runs the next item in this project's task queue. All workflow instructions live
here; the `nextTask` file at the repo root is only a pointer (it is gitignored,
local-only state).

## Steps

1. **Read the pointer.** Open `nextTask` at the repo root. It is gitignored,
   so it never shows up in git status, on GitHub, or (dimmed/hidden) in editors -
   check the disk, not git.
   - If it says `DONE !!!!`, tell the user the queue is empty and stop.
   - Otherwise it names the task, e.g. `Next task: T13 (tasks/T13.md) - <title>`.
   - If the file is missing (fresh clone), list `tasks/`, ask the user which
     task is next, and recreate the pointer before proceeding.
2. **Suggest a session rename.** You cannot rename the session yourself - tell
   the user they can type `/rename T<n>-<short-slug>` if they want it.
3. **Execute the task file.** Read the referenced `tasks/T<n>.md` and implement
   exactly that task - nothing beyond it. Project rules that always apply:
   - Do NOT write test files, even if the spec suggests them.
   - Verify with the `verify` skill (dev server + Playwright).
   - Never run `npm run build` while a dev server is running. The user keeps
     their own dev server on port 3000 - do not kill it; build in an isolated
     copy of the repo (junction `node_modules`) instead.
   - Plain hyphens only - no em dashes in copy, comments, or commits.
   - Ask before committing; never push without explicit approval; no
     Claude co-author trailer (pushes auto-deploy to prod).
4. **Advance the queue.** Once all acceptance criteria pass, update `nextTask`:
   - If `tasks/T<n+1>.md` exists, point to it using the same one-line format.
   - If not, replace the contents with `DONE !!!! (T<n> completed <date>)`.
5. **Report.** The final message MUST include a section describing what changes
   are visible on the frontend after this task.
