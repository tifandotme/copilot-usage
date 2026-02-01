# GitHub Copilot Usage Fetcher

API-based Copilot usage checker. Replaces the old Puppeteer clusterfuck.

## Setup (one-time)

```bash
cd ~/.config/raycast/scripts/fetch_copilot_usage
bun setup_copilot_auth.ts
```

This will:

1. Request a device code from GitHub
2. Show you a URL + code to enter at github.com/login/device
3. Poll for authorization (takes ~10-30 seconds after you authorize)
4. Save the OAuth token to `~/.config/raycast/copilot_token.json`

The token lasts forever (until you revoke it at github.com/settings/applications).

## Usage

```bash
# Full JSON output + formatted summary (to stderr)
bun index.ts

# Raycast integration (shows usage vs month progress)
./executable_copilot_usage.sh
```

## Files

- `setup_copilot_auth.ts` - OAuth device flow setup (run once)
- `index.ts` - Fetches usage from GitHub Copilot API
- `executable_copilot_usage.sh` - Raycast wrapper script

## No Puppeteer = No Bullshit

- **Old**: ~100MB RAM, 5-10 seconds, browser automation
- **New**: ~10MB RAM, <500ms, clean API calls

## Troubleshooting

**"Failed to load token"** → Run setup again: `bun setup_copilot_auth.ts`

**"Token expired or invalid"** → Token was revoked, run setup again

**API errors** → Check that your GitHub account has Copilot access
