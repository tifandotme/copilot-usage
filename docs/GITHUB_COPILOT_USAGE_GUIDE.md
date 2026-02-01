# GitHub Copilot Authentication and Usage Tracking Guide

A comprehensive document detailing how CodexBar authenticates with GitHub Copilot and retrieves usage information.

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Token Storage](#token-storage)
4. [Usage Fetching](#usage-fetching)
5. [API Endpoints](#api-endpoints)
6. [Response Data Structure](#response-data-structure)
7. [Error Handling](#error-handling)

---

## Overview

CodexBar uses GitHub's OAuth Device Flow to authenticate with GitHub Copilot. This approach allows users to authorize the application without directly handling credentials in the app. Once authenticated, the app retrieves usage statistics through GitHub's internal Copilot API.

Key characteristics:

- Minimal OAuth scope: only `read:user` (name and email)
- Device code flow: user enters code at github.com/login/device
- Polling mechanism: checks for token every 5 seconds
- Token storage: macOS Keychain for secure storage
- Usage API: GitHub's internal Copilot endpoint

---

## Authentication Flow

The authentication process consists of three main steps:

### Step 1: Request Device Code

The client initiates the authentication process by requesting a device code from GitHub.

Endpoint: POST https://github.com/login/device/code

Request Headers:

- Accept: application/json
- Content-Type: application/x-www-form-urlencoded

Request Parameters:

- client_id: Iv1.b507a08c87ecfe98 (VS Code Client ID)
- scope: read:user

Request Body Format:
client_id=Iv1.b507a08c87ecfe98&scope=read:user

Response: JSON DeviceCodeResponse

```json
{
  "device_code": "<device_code_string>",
  "user_code": "<user_code_string>",
  "verification_uri": "https://github.com/login/device",
  "expires_in": 900,
  "interval": 5
}
```

Response Fields:

- device_code: Unique code for polling (expires in ~15 minutes)
- user_code: Code displayed to user to enter at GitHub (e.g., 1234-5678)
- verification_uri: URL where user authorizes (https://github.com/login/device)
- expires_in: Expiration time in seconds (typically 900 = 15 minutes)
- interval: Polling interval in seconds (typically 5)

### Step 2: Display User Code and Authorization Instructions

After receiving the device code response, the user is presented with:

- The user_code (e.g., 1234-5678)
- Instructions to visit github.com/login/device
- A note that they will be logged in if authorized

The user code is what they enter at the GitHub website to authorize the device.

### Step 3: Poll for Access Token

The client continuously polls GitHub for an access token until:

- The user authorizes and a token is issued
- The device code expires
- An error condition occurs

Endpoint: POST https://github.com/login/oauth/access_token

Request Headers:

- Accept: application/json
- Content-Type: application/x-www-form-urlencoded

Request Parameters:

- client_id: Iv1.b507a08c87ecfe98 (VS Code Client ID)
- device_code: <device_code_from_step_1>
- grant_type: urn:ietf:params:oauth:grant-type:device_code

Request Body Format:
client_id=Iv1.b507a08c87ecfe98&device_code=<device_code>&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code

Polling Behavior:

- Initial wait: interval seconds (e.g., 5 seconds)
- Subsequent waits: interval seconds between each poll
- Maximum attempts: until device_code expires (900 seconds / ~15 minutes)

Polling Response - Success:

```json
{
  "access_token": "<github_oauth_token>",
  "token_type": "bearer",
  "scope": "read:user"
}
```

Response Fields:

- access_token: The GitHub OAuth token (used for API calls)
- token_type: Bearer token authentication method
- scope: The granted scope (read:user)

Polling Response - Pending Authorization:

```json
{
  "error": "authorization_pending"
}
```

The client continues polling when this error is received.

Polling Response - Rate Limit:

```json
{
  "error": "slow_down"
}
```

When received, add 5 additional seconds to the next polling interval.

Polling Response - Expired:

```json
{
  "error": "expired_token"
}
```

Device code has expired. Restart the authentication flow.

---

## Token Storage

GitHub Copilot tokens are securely stored using macOS Keychain.

### Storage Details

Storage Service:

- Service: com.steipete.CodexBar
- Account: copilot-api-token
- Storage Class: Generic Password (kSecClassGenericPassword)

Access Control:

- Accessibility: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
- Requires device unlock to read
- Automatically locked when device is locked

### Token Lifecycle

Load Process:

1. Check if Keychain access is enabled
2. Prompt user if required
3. Query Keychain for stored token
4. Return token if found and valid
5. Return nil if not found

Store Process:

1. Validate token (must not be empty/whitespace)
2. Trim whitespace
3. Check if token already exists in Keychain
4. If exists: Update Keychain with new token
5. If not exists: Add new token to Keychain

Delete Process:

1. Query Keychain for token
2. Delete if found
3. No error if already deleted

Keychain Query Structure:

```swift
[
  kSecClass: kSecClassGenericPassword,
  kSecAttrService: "com.steipete.CodexBar",
  kSecAttrAccount: "copilot-api-token",
  kSecMatchLimit: kSecMatchLimitOne,
  kSecReturnData: true
]
```

---

## Usage Fetching

Once authenticated and token is obtained, CodexBar fetches usage information by making a request to GitHub's internal Copilot API.

### Usage Fetching Workflow

1. Retrieve stored GitHub OAuth token from Keychain
2. Make authenticated request to GitHub Copilot API
3. Parse response to extract quota information
4. Calculate usage percentages
5. Return usage snapshot with timestamp

### API Request Details

Endpoint: GET https://api.github.com/copilot_internal/user

Request Headers:

- Authorization: token <github_oauth_token>
- Accept: application/json
- Editor-Version: vscode/1.96.2
- Editor-Plugin-Version: copilot-chat/0.26.7
- User-Agent: GitHubCopilotChat/0.26.7
- X-Github-Api-Version: 2025-04-01

Request Method: GET
Request Body: None

#### Header Explanation

Authorization:

- Format: "token <github_oauth_token>"
- Uses the GitHub OAuth token obtained from device flow
- Not the Copilot API key

Editor-Version:

- Simulates VS Code editor version 1.96.2
- GitHub's API may use this for feature gating
- Required for proper response formatting

Editor-Plugin-Version:

- Simulates Copilot Chat plugin version 0.26.7
- Indicates which version of Copilot features are expected
- Affects response structure

User-Agent:

- Identifies as GitHubCopilotChat/0.26.7
- GitHub uses this to identify client type
- Required for internal API access

X-Github-Api-Version:

- API version date: 2025-04-01
- Indicates which API schema version to use
- Ensures response consistency

#### HTTP Status Codes

- 200 OK: Successfully retrieved usage
- 401 Unauthorized: Token is invalid or expired
- 403 Forbidden: Token lacks required scope or permissions
- Other errors: Server error or unexpected response

---

## Response Data Structure

The API returns a JSON response containing quota and plan information.

### Response Schema

```json
{
  "quota_snapshots": {
    "premium_interactions": {
      "entitlement": 500000,
      "remaining": 245000,
      "percent_remaining": 49.0,
      "quota_id": "premium_interactions"
    },
    "chat": {
      "entitlement": 100,
      "remaining": 45,
      "percent_remaining": 45.0,
      "quota_id": "chat"
    }
  },
  "copilot_plan": "business",
  "assigned_date": "2024-01-15",
  "quota_reset_date": "2025-01-15"
}
```

### Field Descriptions

quota_snapshots: Contains multiple quota types

premium_interactions: Premium completions quota

- entitlement: Maximum allowed requests (quota limit)
- remaining: Requests remaining in current period
- percent_remaining: Percentage of quota left (0-100)
- quota_id: Unique quota identifier

chat: Chat message quota

- entitlement: Maximum allowed chat messages
- remaining: Chat messages remaining
- percent_remaining: Percentage remaining (0-100)
- quota_id: Unique quota identifier

copilot_plan: User's subscription plan

- Possible values: "business", "individual", "free", etc.
- Capitalized for display

assigned_date: Date plan was assigned (ISO format)

- Example: "2024-01-15"

quota_reset_date: Date quotas reset

- Example: "2025-01-15"
- Not per-quota: same reset for all quotas

### Data Processing

The fetcher processes the response as follows:

1. Extract premium_interactions quota snapshot
2. Extract chat quota snapshot
3. Calculate used percentage from percent_remaining
   - Formula: usedPercent = max(0, 100 - percentRemaining)
4. Create RateWindow objects for each quota
5. Build ProviderIdentitySnapshot with plan name
6. Return UsageSnapshot with:
   - Primary rate window (premium_interactions)
   - Secondary rate window (chat)
   - No tertiary rate window
   - No provider cost data
   - Current timestamp

### Usage Snapshot Structure

```swift
UsageSnapshot(
  primary: RateWindow(
    usedPercent: 51.0,
    windowMinutes: nil,
    resetsAt: nil,
    resetDescription: nil
  ),
  secondary: RateWindow(
    usedPercent: 55.0,
    windowMinutes: nil,
    resetsAt: nil,
    resetDescription: nil
  ),
  tertiary: nil,
  providerCost: nil,
  updatedAt: Date(),
  identity: ProviderIdentitySnapshot(
    providerID: .copilot,
    accountEmail: nil,
    accountOrganization: nil,
    loginMethod: "Business"
  )
)
```

Note: windowMinutes and resetsAt are not provided by GitHub's API, so they remain nil.

---

## API Endpoints

### Summary of All Endpoints

Device Code Request:

- URL: https://github.com/login/device/code
- Method: POST
- Purpose: Initiate device authorization flow

Token Poll:

- URL: https://github.com/login/oauth/access_token
- Method: POST
- Purpose: Exchange device code for access token

Usage Query:

- URL: https://api.github.com/copilot_internal/user
- Method: GET
- Purpose: Retrieve current usage statistics

### OAuth Configuration

Client ID: Iv1.b507a08c87ecfe98

- Type: GitHub OAuth App ID
- Source: VS Code's registered OAuth app
- Scope: read:user

Verification URI: https://github.com/login/device

- Where users authorize the device
- Valid during device code lifetime

---

## Error Handling

The authentication and usage fetching processes handle multiple error conditions.

### Device Flow Errors

authorization_pending:

- Meaning: User hasn't authorized yet
- Action: Continue polling with same interval
- Recovery: Automatic, user must authorize on GitHub

slow_down:

- Meaning: Polling too frequently, backing off
- Action: Wait interval + 5 additional seconds
- Recovery: Automatic, next poll after extended wait

expired_token:

- Meaning: Device code expired (>15 minutes)
- Action: Throw URLError(.timedOut)
- Recovery: Restart authentication from Step 1

Generic Failure:

- Meaning: Other error in response
- Action: Throw URLError(.userAuthenticationRequired)
- Recovery: Restart authentication or check error details

### Usage Fetching Errors

Bad URL:

- Meaning: URL string malformed
- Action: Throw URLError(.badURL)
- Recovery: Check endpoint URL is correct

Bad Server Response:

- Meaning: Status code not 200-299
- Action: Throw URLError(.badServerResponse)
- Recovery: Check API endpoint, retry later

Unauthorized (401):

- Meaning: Token invalid, expired, or revoked
- Action: Throw URLError(.userAuthenticationRequired)
- Recovery: Re-authenticate with device flow

Forbidden (403):

- Meaning: Token lacks required scope
- Action: Throw URLError(.userAuthenticationRequired)
- Recovery: Re-authenticate with broader scope

Network Errors:

- Meaning: Connection issue
- Action: Propagate URLError
- Recovery: Retry with exponential backoff

JSON Decode Error:

- Meaning: Response not valid JSON or wrong format
- Action: Throw DecodingError
- Recovery: Verify API response schema matches code

---

## Implementation Code Snippets

### Device Code Request

```swift
let components = URLComponents(string: "https://github.com/login/device/code")!
let request = URLRequest(url: components.url!)

var postRequest = request
postRequest.httpMethod = "POST"
postRequest.setValue("application/json", forHTTPHeaderField: "Accept")
postRequest.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

let body = [
  "client_id": "Iv1.b507a08c87ecfe98",
  "scope": "read:user",
]
postRequest.httpBody = formURLEncodedBody(body)

let (data, response) = try await URLSession.shared.data(for: postRequest)
let deviceCodeResponse = try JSONDecoder().decode(DeviceCodeResponse.self, from: data)
```

### Token Polling Loop

```swift
let url = URL(string: "https://github.com/login/oauth/access_token")!
var request = URLRequest(url: url)
request.httpMethod = "POST"

let body = [
  "client_id": "Iv1.b507a08c87ecfe98",
  "device_code": deviceCode,
  "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
]
request.httpBody = formURLEncodedBody(body)

while true {
  try await Task.sleep(nanoseconds: UInt64(interval) * 1_000_000_000)
  try Task.checkCancellation()

  let (data, _) = try await URLSession.shared.data(for: request)

  if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
     let error = json["error"] as? String {
    if error == "authorization_pending" {
      continue
    }
    if error == "slow_down" {
      try await Task.sleep(nanoseconds: 5_000_000_000)
      continue
    }
    if error == "expired_token" {
      throw URLError(.timedOut)
    }
    throw URLError(.userAuthenticationRequired)
  }

  if let tokenResponse = try? JSONDecoder().decode(AccessTokenResponse.self, from: data) {
    return tokenResponse.accessToken
  }
}
```

### Keychain Token Storage

```swift
// Store token
let data = token.data(using: .utf8)!
let query: [String: Any] = [
  kSecClass as String: kSecClassGenericPassword,
  kSecAttrService as String: "com.steipete.CodexBar",
  kSecAttrAccount as String: "copilot-api-token",
]
let attributes: [String: Any] = [
  kSecValueData as String: data,
  kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
]

let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
if updateStatus == errSecSuccess {
  return
}
if updateStatus == errSecItemNotFound {
  SecItemAdd((query + attributes) as CFDictionary, nil)
}
```

### Usage API Request

```swift
guard let url = URL(string: "https://api.github.com/copilot_internal/user") else {
  throw URLError(.badURL)
}

var request = URLRequest(url: url)
request.setValue("token \(token)", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Accept")
request.setValue("vscode/1.96.2", forHTTPHeaderField: "Editor-Version")
request.setValue("copilot-chat/0.26.7", forHTTPHeaderField: "Editor-Plugin-Version")
request.setValue("GitHubCopilotChat/0.26.7", forHTTPHeaderField: "User-Agent")
request.setValue("2025-04-01", forHTTPHeaderField: "X-Github-Api-Version")

let (data, response) = try await URLSession.shared.data(for: request)

guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
  throw URLError(.badServerResponse)
}

let usage = try JSONDecoder().decode(CopilotUsageResponse.self, from: data)
```

---

## Summary

CodexBar's GitHub Copilot integration follows a secure three-step OAuth Device Flow:

1. Request device code from GitHub
2. User authorizes at github.com/login/device with user code
3. Poll GitHub for access token every 5 seconds
4. Store token securely in macOS Keychain
5. Use token to fetch usage from GitHub's internal Copilot API

The implementation prioritizes:

- User security: minimal OAuth scope, Keychain storage
- User experience: device flow avoids credential entry, polling with backoff
- Reliability: comprehensive error handling, automatic retries, clear error messages
- Standards compliance: OAuth 2.0 device flow, RESTful API practices

All communication uses HTTPS and tokens are never logged or exposed to console.
