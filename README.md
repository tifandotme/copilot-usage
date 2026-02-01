# GitHub Copilot Usage

CLI tool to check your GitHub Copilot usage stats.

## Why

Personal tool for tracking Copilot quota and usage limits.

## Installation

### Prebuilt Binary (macOS ARM64)

Download from [Releases](https://github.com/tifandotme/copilot-usage/releases):

```bash
chmod +x copilot-usage
./copilot-usage setup
./copilot-usage
```

### Build from Source

Requires [Bun](https://bun.sh):

```bash
git clone https://github.com/tifandotme/copilot-usage.git
cd copilot-usage
bun install
bun run build
```

## Usage

```bash
# One-time setup (OAuth with GitHub)
./copilot-usage setup

# Fetch usage (JSON output)
./copilot-usage
```

Run `copilot-usage setup` again if authentication fails.

## License

MIT
