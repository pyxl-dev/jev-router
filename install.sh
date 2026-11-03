#!/bin/sh
# jev-router installer: adds the pyxl-dev/jev-router marketplace to Claude Code and installs the mod.
# Re-run it to update. --uninstall removes the mod and the marketplace. Nothing outside your home folder is touched.
set -eu

SOURCE="${JEV_ROUTER_SOURCE:-pyxl-dev/jev-router}"
PLUGIN="jev-router"
KEYCHAIN_SERVICE="openrouter-jev"

if [ -t 1 ]; then B=$(printf '\033[1m'); G=$(printf '\033[32m'); Y=$(printf '\033[33m'); R=$(printf '\033[31m'); N=$(printf '\033[0m'); else B= G= Y= R= N=; fi
ok()   { printf '%s✓%s %s\n' "$G" "$N" "$1"; }
warn() { printf '%s!%s %s\n' "$Y" "$N" "$1"; }
die()  { printf '%s✗%s %s\n' "$R" "$N" "$1" >&2; exit 1; }

command -v claude >/dev/null || die "the claude command is missing. Install Claude Code first: https://claude.com/claude-code"

if [ "${1:-}" = "--uninstall" ]; then
  if claude plugin uninstall "$PLUGIN@$PLUGIN" >/dev/null 2>&1; then ok "removed the $PLUGIN mod"; else warn "the $PLUGIN mod was not installed"; fi
  if claude plugin marketplace remove "$PLUGIN" >/dev/null 2>&1; then ok "removed the $PLUGIN marketplace"; else warn "the $PLUGIN marketplace was not configured"; fi
  echo "Left in place: the decision log in ~/.claude/jev-router and the Keychain item '$KEYCHAIN_SERVICE'."
  exit 0
fi

printf '%sjev-router%s installer\n\n' "$B" "$N"

# 1. Marketplace (adding it again is harmless; update picks up new versions).
if claude plugin marketplace list 2>/dev/null | grep -q "$PLUGIN"; then
  claude plugin marketplace update "$PLUGIN" >/dev/null 2>&1 && ok "updated the $PLUGIN marketplace" || warn "could not update the marketplace, keeping the current one"
else
  claude plugin marketplace add "$SOURCE" >/dev/null 2>&1 || die "could not add the marketplace $SOURCE (run  claude plugin marketplace add $SOURCE  to see why)"
  ok "added the marketplace $SOURCE"
fi

# 2. The mod.
if claude plugin list 2>/dev/null | grep -q "$PLUGIN@$PLUGIN"; then
  claude plugin update "$PLUGIN@$PLUGIN" >/dev/null 2>&1 && ok "$PLUGIN is up to date" || warn "could not update $PLUGIN, keeping the installed version"
else
  claude plugin install "$PLUGIN@$PLUGIN" >/dev/null 2>&1 || die "could not install $PLUGIN (run  claude plugin install $PLUGIN@$PLUGIN  to see why)"
  ok "installed $PLUGIN"
fi

# 3. API key.
if [ "$(uname -s)" = "Darwin" ] && security find-generic-password -s "$KEYCHAIN_SERVICE" >/dev/null 2>&1; then
  ok "OpenRouter key found in the Keychain ($KEYCHAIN_SERVICE)"
else
  warn "no OpenRouter key yet: without one the mod stays silent."
  echo "  macOS:  security add-generic-password -U -a \"\$USER\" -s $KEYCHAIN_SERVICE -w"
  echo "  or fill the 'OpenRouter API key' option of the plugin (Plugins panel in the app)."
fi

printf '\n%sDone.%s Start a new Claude Code session, then send a prompt of 8 characters or more: the Jev band shows up above the prompt.\n' "$B" "$N"
