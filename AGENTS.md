# Instructions for AI agents

You are an AI coding agent (Claude Code, Codex, Cursor...) and your user asked you to install or use **jev-router**. This file tells you how. Keep the safety rules at the end: they matter more than the rest.

## What it does

jev-router is a Claude Code mod (plugin). On every prompt the user sends, it asks **Jev** (TypeSafe System One, `typesafe/jev-1.13` on OpenRouter) one `choice` question: how much reasoning effort (`low`, `medium`, `high`) the task needs. When Jev is at least 60% sure, the main loop runs at that effort. Otherwise the app's own effort setting stays.

- The model is never switched: a model change drops the prompt cache, an effort change keeps it.
- A band above the prompt shows Jev's pick, its confidence and the effort used, with buttons to pin an effort, turn Auto off, or unpin. Each reply gets a small `effort : <level>` line.
- Subagents, slash commands and messages shorter than 8 characters are left alone. If Jev takes over 3 s or fails, the message goes through unchanged.
- Each rated message writes one JSON line to `~/.claude/jev-router/decisions/<YYYY-MM>/<session id>.jsonl` (first 200 characters of the prompt, Jev's pick, the effort that ran, token usage). The log stays local.

It needs Claude Code and an OpenRouter key with some credit. Without a key the mod stays silent.

## Install

Run, then read the output: every line starts with `✓`, `!` (optional piece missing) or `✗` (blocking).

```sh
curl -fsSL https://raw.githubusercontent.com/pyxl-dev/jev-router/main/install.sh | sh
```

It adds the `pyxl-dev/jev-router` marketplace and installs `jev-router@jev-router`. Manual equivalent:

```sh
claude plugin marketplace add pyxl-dev/jev-router
claude plugin install jev-router@jev-router
```

- `✗ the claude command is missing`: tell the user to install Claude Code. Do not install it for them without asking.
- `! no OpenRouter key yet`: the user must provide a key themselves (see Safety rules). Either they fill the plugin's `OpenRouter API key` option, or on macOS they run `security add-generic-password -U -a "$USER" -s openrouter-jev -w` in their own terminal (it prompts for the key).
- Check: `claude plugin list` shows `jev-router@jev-router`. The mod loads in the next Claude Code session.
- Uninstall: `curl -fsSL https://raw.githubusercontent.com/pyxl-dev/jev-router/main/install.sh | sh -s -- --uninstall`.

## Use

Nothing to run. The user keeps sending messages. They can click `low`, `medium` or `high` in the band to pin an effort (it wins over Jev until unpinned), and toggle Auto. To report how often each effort ran:

```sh
cat ~/.claude/jev-router/decisions/*/*.jsonl | jq -s 'group_by(.effort) | map({effort: .[0].effort, turns: length, avgOutput: (map(.outputTokens // 0) | add / length | round)})'
```

## Safety rules

- Never ask the user to paste the OpenRouter key in chat, and never write it into a file, a command line, a log or an issue. Have them enter it in the plugin option or in their own terminal.
- Tell the user before installing: every prompt they send (first 4000 characters) goes to OpenRouter and TypeSafe to be rated. If their prompts must stay on their machine, do not install it.
- Do not read the decision log aloud beyond aggregate numbers: it holds the start of their prompts.
- Do not edit the user's Claude Code settings by hand: use the `claude plugin` commands.
