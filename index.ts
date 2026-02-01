import { parseArgs } from "util";

const CLIENT_ID = "Iv1.b507a08c87ecfe98";
const SCOPE = "read:user";
const TOKEN_FILE = "./copilot_token.json";

interface TokenData {
  access_token: string;
  created_at: string;
  client_id: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface QuotaSnapshot {
  entitlement: number;
  remaining: number;
  percent_remaining: number;
  quota_id: string;
  quota_remaining: number;
  overage_count: number;
  overage_permitted: boolean;
  unlimited: boolean;
  timestamp_utc: string;
}

interface Endpoints {
  api: string;
  "origin-tracker": string;
  proxy: string;
  telemetry: string;
}

interface CopilotUsageResponse {
  access_type_sku: string;
  analytics_tracking_id: string;
  assigned_date: string;
  can_signup_for_limited: boolean;
  chat_enabled: boolean;
  copilot_plan: string;
  organization_login_list: string[];
  organization_list: string[];
  endpoints: Endpoints;
  quota_reset_date: string;
  quota_reset_date_utc: string;
  quota_snapshots: {
    premium_interactions?: QuotaSnapshot;
    chat?: QuotaSnapshot;
    completions?: QuotaSnapshot;
    [key: string]: QuotaSnapshot | undefined;
  };
}

function formURLEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formURLEncode({
      client_id: CLIENT_ID,
      scope: SCOPE,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to request device code: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<DeviceCodeResponse>;
}

async function pollForToken(
  deviceCode: string,
  interval: number,
): Promise<string> {
  const maxAttempts = 180;
  const url = "https://github.com/login/oauth/access_token";

  const body = formURLEncode({
    client_id: CLIENT_ID,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Token poll failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      error?: string;
      access_token?: string;
    };

    if (data.error) {
      if (data.error === "authorization_pending") {
        process.stdout.write(".");
        continue;
      }
      if (data.error === "slow_down") {
        process.stdout.write("(slow)");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      if (data.error === "expired_token") {
        throw new Error("Device code expired. Please run setup again.");
      }
      throw new Error(`OAuth error: ${data.error}`);
    }

    if (data.access_token) {
      return data.access_token;
    }
  }

  throw new Error("Polling timed out after 15 minutes.");
}

async function runSetup(): Promise<void> {
  console.log("🔐 GitHub Copilot OAuth Setup\n");

  console.log("Requesting device code from GitHub...");
  const deviceCodeResponse = await requestDeviceCode();

  console.log("\n📱 Authorization Required\n");
  console.log(`Visit: ${deviceCodeResponse.verification_uri}`);
  console.log(`Enter code: ${deviceCodeResponse.user_code}`);
  console.log(
    `\nWaiting for authorization (expires in ${deviceCodeResponse.expires_in}s)...`,
  );
  process.stdout.write("Polling");

  const accessToken = await pollForToken(
    deviceCodeResponse.device_code,
    deviceCodeResponse.interval,
  );

  console.log("\n\n✅ Authorized!");

  const tokenData: TokenData = {
    access_token: accessToken,
    created_at: new Date().toISOString(),
    client_id: CLIENT_ID,
  };

  await Bun.write(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
  console.log(`Token saved to: ${TOKEN_FILE}`);
}

async function loadToken(tokenFile: string): Promise<string> {
  const file = Bun.file(tokenFile);
  if (!(await file.exists())) {
    throw new Error(
      `Token file not found: ${tokenFile}. Run: copilot-usage setup`,
    );
  }

  const tokenData: TokenData = JSON.parse(await file.text());

  if (!tokenData.access_token) {
    throw new Error("Invalid token: missing access_token field");
  }

  return tokenData.access_token;
}

async function fetchCopilotUsage(token: string): Promise<CopilotUsageResponse> {
  const response = await fetch("https://api.github.com/copilot_internal/user", {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/json",
      "Editor-Version": "vscode/1.96.2",
      "Editor-Plugin-Version": "copilot-chat/0.26.7",
      "User-Agent": "GitHubCopilotChat/0.26.7",
      "X-Github-Api-Version": "2025-04-01",
    },
  });

  if (response.status === 401) {
    throw new Error("Token expired or invalid. Run: copilot-usage setup");
  }

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<CopilotUsageResponse>;
}

function showHelp(): void {
  console.log(`copilot-usage - GitHub Copilot usage tracker

Usage:
  copilot-usage setup                 Authenticate and save token to ./copilot_token.json
  copilot-usage [options]             Fetch usage (reads from ./copilot_token.json by default)

Options:
  --token-file <path>  Read token from custom file path
  --help, -h           Show this help

Examples:
  copilot-usage setup
  copilot-usage
  copilot-usage --token-file ~/.config/copilot-token.json`);
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "token-file": {
        type: "string",
      },
      help: {
        type: "boolean",
        short: "h",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) {
    showHelp();
    return;
  }

  const command = positionals[0];

  if (command === "setup") {
    await runSetup();
  } else if (command) {
    console.error(`Unknown command: ${command}`);
    console.error("Run with --help for usage");
    process.exit(1);
  } else {
    const tokenFile = values["token-file"] || TOKEN_FILE;
    const token = await loadToken(tokenFile);
    const usage = await fetchCopilotUsage(token);
    console.log(JSON.stringify(usage, null, 2));
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
