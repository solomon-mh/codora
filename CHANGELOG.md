# Changelog

## 0.2.0

First public release.

- **Questions about your own code.** Codora reads your recent git changes and asks one short question about code you just worked on, multiple choice or a short written answer, written by the model you choose (Claude Code, GitHub Copilot or any VS Code chat model, or an Anthropic, OpenAI or Gemini key).
- **Answer-key check.** Every multiple-choice question is answered again by a model without its answer key before you see it, using a second model when you have one. Questions whose key doesn't hold up are thrown away.
- **Report a question.** Mark a question as wrong, unclear or not about your code. A reported answer is taken back out of your scores.
- **Retention reviews.** Code you were asked about comes back 7, 21 and 60 days later (3 days after a miss), so your aura reflects what you still understand, not just today's diff.
- **Aura.** A 0–100 reading of how well you know your code, by category, per project and overall. Every wrong answer lowers it; one lucky answer can't max it out.
- **Private by default.** Scores and history stay on your machine. Anonymous usage counts are opt-in and never include code, file names, questions or answers.
