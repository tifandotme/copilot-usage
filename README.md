# GitHub Copilot Usage Fetcher

A lightweight, API-based GitHub Copilot usage checker that replaces browser automation with clean GitHub API calls.

## Installation

```bash
git clone https://github.com/tifandotme/copilot-usage.git
cd copilot-usage
bun install
```

## Setup (one-time authentication)

```bash
bun setup_copilot_auth.ts
```

This will:

1. Request a device code from GitHub
2. Display a URL and code to enter at [github.com/login/device](https://github.com/login/device)
3. Poll for authorization (takes ~10-30 seconds after you authorize)
4. Save the OAuth token to `~/.config/copilot_token.json`

The token persists until you revoke it at [github.com/settings/applications](https://github.com/settings/applications).

## Usage

```bash
# Fetch and display usage with JSON output
bun index.ts
```

## Project Structure

- `setup_copilot_auth.ts` - OAuth device flow setup
- `index.ts` - Main script to fetch Copilot usage from GitHub API
- `package.json` - Project dependencies

## Troubleshooting

| Issue                      | Solution                                           |
| -------------------------- | -------------------------------------------------- |
| "Failed to load token"     | Re-run authentication: `bun setup_copilot_auth.ts` |
| "Token expired or invalid" | Token was revoked; re-authenticate                 |
| API errors                 | Verify your GitHub account has Copilot access      |

## License

MIT

