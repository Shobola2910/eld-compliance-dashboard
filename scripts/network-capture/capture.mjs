// Standalone network-capture tool. Not part of the main app.
//
// Usage:
//   cd scripts/network-capture
//   npm install
//   npx playwright install chromium   (one-time, downloads a browser binary)
//   npm run capture -- <start_url> [api_host_filter]
//
// Examples:
//   npm run capture -- https://app.leadereld.com
//   npm run capture -- https://app.factoreld.com api.drivehos.app
//
// If api_host_filter is omitted (first time capturing a new provider, when
// you don't know its backend host yet), every XHR/fetch request is captured
// regardless of domain -- once you see which host the real API calls, pass
// it explicitly next time to cut out unrelated noise (analytics, etc).
//
// This opens a REAL, visible Chrome window. You log in yourself (type your
// own email/password, solve any captcha yourself -- this script never
// touches credentials or automates login in any way). While that window is
// open, click around normally: open a driver's log, click Certify, click
// Normalize, whatever needs capturing. Every matching request/response gets
// appended to capture-log.jsonl in this folder as it happens.
//
// When you're done clicking, press Ctrl+C in this terminal (or just close
// the browser window) to stop. Share capture-log.jsonl (or the relevant
// lines from it) back to continue wiring up the real adapter code.

import { chromium } from "playwright";
import { writeFileSync, appendFileSync } from "fs";

const [, , argStartUrl, argApiHostFilter] = process.argv;
const START_URL = argStartUrl || "https://app.factoreld.com";
const API_HOST_FILTER = argApiHostFilter || null; // null = capture all XHR/fetch, any host
const LOG_FILE = "capture-log.jsonl";

// Fields that must never land on disk (or get pasted into a chat) in plain text.
const SENSITIVE_KEYS = new Set([
  "password",
  "recaptcha_token",
  "authorization",
  "access_token",
  "refresh_token",
]);

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(val);
    }
    return out;
  }
  return value;
}

function redactJsonString(maybeJson) {
  if (!maybeJson) return maybeJson;
  try {
    return JSON.stringify(redact(JSON.parse(maybeJson)));
  } catch {
    return maybeJson; // not JSON (e.g. form-encoded) -- leave as-is
  }
}

writeFileSync(LOG_FILE, ""); // start fresh each run

function logEvent(event) {
  const safeEvent = {
    ...event,
    headers: redact(event.headers),
    postData: redactJsonString(event.postData),
    responseBody: redact(event.responseBody),
  };
  appendFileSync(LOG_FILE, JSON.stringify(safeEvent) + "\n");
  console.log(`[captured] ${event.method} ${event.url} -> ${event.status ?? "pending"}`);
}

function shouldCapture(request) {
  if (API_HOST_FILTER) return request.url().includes(API_HOST_FILTER);
  const type = request.resourceType();
  return type === "xhr" || type === "fetch";
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pending = new Map();

  page.on("request", (request) => {
    if (!shouldCapture(request)) return;
    pending.set(request, {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData(),
      timestamp: new Date().toISOString(),
    });
  });

  page.on("response", async (response) => {
    const request = response.request();
    if (!shouldCapture(request)) return;
    const base =
      pending.get(request) ?? {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        timestamp: new Date().toISOString(),
      };

    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch {
      try {
        responseBody = await response.text();
      } catch {
        responseBody = null;
      }
    }

    logEvent({ ...base, status: response.status(), responseBody });
    pending.delete(request);
  });

  await page.goto(START_URL);

  console.log("\nBrowser is open -- log in yourself, then click whatever needs capturing");
  console.log(`(Certify, Normalize, etc). Every API call is being saved to ${LOG_FILE}.`);
  console.log("Press Ctrl+C here (or close the browser window) when you're done.\n");

  await new Promise((resolve) => {
    page.on("close", resolve);
    process.on("SIGINT", () => {
      browser.close().then(resolve);
    });
  });

  console.log(`\nDone. See ${LOG_FILE} for everything that was captured.`);
  process.exit(0);
}

main();
