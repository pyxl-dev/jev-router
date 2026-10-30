# jev-router

A Claude Code mod that lets **Jev** (TypeSafe System One, `typesafe/jev-1.13` on OpenRouter) pick the reasoning effort (`low` / `medium` / `high`) of each message you send.

- On every prompt, one Jev `choice` question rates how much effort the task needs (~0.5 s, a fraction of a cent).
- When Jev is at least 60% sure, the main loop runs at that effort. Otherwise the app's own setting stays.
- The model is never switched: a model change drops the prompt cache, an effort change keeps it.
- A band above the prompt shows Jev's pick, its confidence and the effort actually used, with buttons to pin an effort, turn Auto off, or unpin.
- Each reply gets a small `effort : <level>` line under it.
- Subagents, slash commands and messages shorter than 8 characters are left alone. If Jev is slow (over 3 s) or fails, the message goes through unchanged.

## Install

```
/plugin install jev-router --marketplace pyxl-dev/jev-router
```

Or from a shell:

```bash
claude plugin marketplace add pyxl-dev/jev-router
claude plugin install jev-router@jev-router
```

In the desktop app: **+** → **Plugins** → **Add marketplace** (`pyxl-dev/jev-router`) → **Add plugin**.

## API key

You need an OpenRouter key with some credit.

- Set it in the plugin's `OpenRouter API key` option at install time (stored in secure storage), or
- on macOS, leave the option empty and put the key in the Keychain yourself:

```bash
security add-generic-password -U -a "$USER" -s openrouter-jev -w
```

Without a key the mod stays silent.

## Privacy

Every prompt you send (first 4000 characters) goes to OpenRouter and TypeSafe to be rated. Don't use this mod in sessions where your prompts must stay on your machine.

## License

MIT
