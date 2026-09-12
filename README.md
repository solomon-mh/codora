# Codora

Increase your aura by knowing what you code.

Codora is a VS Code extension for the AI-assisted coding era. It doesn't try to
detect whether you used AI — it periodically challenges you with short,
contextual questions about the code you're actively working on, and builds a
personal comprehension score (**Aura**) over time. Using AI well and
understanding your code are not in conflict; the goal is the second one.

## How it works

While you code, Codora watches high-level activity signals (edits, saves, git
state — never keystrokes) to track active coding time. Once you've been
actively coding for your configured interval, it offers a short challenge
built from your **actual, recent code**: a function you just touched, a guard
clause you added, a file's role in the project. Multiple-choice and free-text
answers are scored immediately, and your Aura and per-category progress
(Recall, Reasoning, Debugging, Architecture, Testing, Security, Performance,
Retention) update from there.

If Codora can't build a confident, defensible question from what's actually
in your code, it skips the challenge rather than asking something generic.

## Privacy

Everything is local-first: your source code, git data, AI-instruction files,
questions, answers, and scores are stored only in VS Code's local extension
storage. Nothing is uploaded. There is no account and no backend in this
version.

## Development

```bash
npm install
npm run compile   # build the extension host + webviews
npm run watch      # rebuild on change
npm test           # run unit tests
```

Press `F5` in VS Code to launch an Extension Development Host with Codora
loaded against your open workspace.

## Status

This is a V1 core-loop build: session tracking, workspace/git/AI-instruction
context gathering, deterministic (template-based) question generation,
scoring, streaks, and badges are fully wired to real local data. Real
LLM-backed answer evaluation, deeper adaptive-difficulty tuning, and a public
leaderboard are intentionally out of scope for this version — see the
`Evaluator` interface in `src/core/scoring/Evaluator.ts` for how evaluation
is designed to be swapped in later without breaking callers.
