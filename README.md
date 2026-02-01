# GitHub Copilot Usage Fetcher

A lightweight CLI tool to check GitHub Copilot usage via API calls.

## Installation

### Prebuilt Binary (macOS ARM64 only)

Download the latest `copilot-usage` binary from the [Releases](https://github.com/tifandotme/copilot-usage/releases) page.

```bash
# Make executable and run
chmod +x copilot-usage
./copilot-usage
```

### Build from Source

Requires [Bun](https://bun.sh) runtime.

```bash
git clone https://github.com/tifandotme/copilot-usage.git
cd copilot-usage
bun install
```

Build binary:

```bash
bun run build
```

## Usage

### Setup (one-time authentication)

```bash
# Using the binary
./copilot-usage setup

# Or with Bun
bun index.ts setup
```

This will:

1. Request a device code from GitHub
2. Display a URL and code to enter at [github.com/login/device](https://github.com/login/device)
3. Poll for authorization (takes ~10-30 seconds after you authorize)
4. Save the OAuth token to `./copilot_token.json`

The token persists until you revoke it at [github.com/settings/applications](https://github.com/settings/applications).

### Fetch Usage

```bash
# Using the binary
./copilot-usage

# Or with Bun
bun index.ts

# With custom token file
./copilot-usage --token-file ~/.config/copilot-token.json
```

Output is JSON formatted.

## Available Scripts

- `bun run setup` - Authenticate and save token
- `bun run usage` - Fetch Copilot usage
- `bun run dev` - Run with watch mode
- `bun run test` - Run tests
- `bun run typecheck` - TypeScript type check
- `bun run build` - Compile binary
- `bun run release` - Create release

## Project Structure

- `index.ts` - Main entry point with setup and usage commands
- `copilot_token.json` - OAuth token storage (gitignored)
- `copilot-usage` - Compiled binary (after build)

## Troubleshooting

| Issue                      | Solution                                      |
| -------------------------- | --------------------------------------------- |
| "Token file not found"     | Re-run authentication: `copilot-usage setup`  |
| "Token expired or invalid" | Token was revoked; re-authenticate            |
| API errors                 | Verify your GitHub account has Copilot access |

## License

MIT
