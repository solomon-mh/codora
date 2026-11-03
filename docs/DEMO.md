# Codora: 2-minute demo script

For the landing page, the Marketplace listing and accelerator applications.
One continuous take of VS Code, with a voiceover recorded over it afterwards.

## Before recording (10 minutes)

1. **Use a real project you know**, not Codora itself. A small TypeScript or
   Python repo reads best. Viewers should recognise the kind of code.
2. **Have a change ready.** Ask Claude Code or Copilot to make one
   meaningful edit, such as adding a retry with backoff to a fetch helper,
   and leave it uncommitted so it shows in the git diff.
3. **Clean the editor:** VS Code at 1920×1080, zoom level 1
   (`"window.zoomLevel": 1`), one editor tab open, minimap off, notifications
   cleared, and the Codora icon visible in the activity bar.
4. **Test the model once** with *Codora: Start Challenge*, so the first
   question on camera arrives quickly.
5. **Recorder:** OBS Studio or Kooha (Fedora), 1080p, 30 fps. Record the
   screen only; add the voiceover afterwards.

## Shot list

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00–0:10 | The editor. Claude Code applies the retry change; the diff is visible. | "AI writes more of our code every month. The question is whether we still understand it." |
| 0:10–0:20 | Run **Codora: Start Challenge**. The panel opens beside the code. | "Codora asks one short question about code you just changed. Not trivia: your code." |
| 0:20–0:35 | Hold on the question and the code shown with it. Move the pointer over the answers. | "It reads your git diff and asks what this code actually does. The code is right there with the question." |
| 0:35–0:50 | Press **3** for a plausible wrong answer, then **Ctrl+Enter**. The result: "Not quite.", the right answer in green, yours in red, the aura going down. | "Get it wrong, and you see the right answer and why. Your aura goes down. Every wrong answer counts." |
| 0:50–1:05 | Point at "The marked answer is wrong", but don't click it. | "Every answer key is checked by a model answering blind before you see it, and if a question is still wrong, you report it and it's taken back out of your score." |
| 1:05–1:15 | Click **Back to coding**. Open the Codora sidebar: the aura reading and categories. | "Over time, that becomes your aura: how well you know your own code, by category." |
| 1:15–1:35 | **Open dashboard**: the verdict sentence, the 0–100 reading on its scale, categories weakest first. | "The dashboard tells you where you're strong and where you're shipping code you couldn't explain." |
| 1:35–1:50 | Scroll to the week chart, then open **History** and one answered question. | "And it comes back. Code you were asked about returns days and weeks later, so you know what you still understand, not just today's diff." |
| 1:50–2:00 | Back to the editor. End card: "Codora: know the code you ship", the Marketplace URL. | "AI is allowed. Not understanding your code isn't. Codora, free for VS Code." |

## Notes

- **One take of the pictures, voice later.** It's far easier to match a
  calm voiceover to the footage than to talk and click at once.
- **Keep the pointer still** while the viewer reads. Pauses read as
  confidence; a darting pointer reads as nerves.
- **Don't fake anything.** Use a real question and a real wrong answer.
  If the model writes a weak question, report it on camera; that's a
  feature.
- **For the Marketplace**, export a 6–10 second GIF of 0:20–0:50 (the
  question, then the result) for the top of the README.
