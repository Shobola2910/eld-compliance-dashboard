// Standalone network-capture tool. Not part of the main app.
//
// Usage:
//   cd scripts/network-capture
//   npm install
//   npx playwright install chromium   (one-time, downloads a browser binary)
//   npm run capture
//
// This opens a REAL, visible Chrome window. You log in yourself (type your
// own email/password, solve any captcha yourself -- this script never
// touches credentials or automates login in any way). While that window is
// open, click around normally: open a driver's log, click Certify, click
// Normalize, whatever needs capturing. Every request/response to the target
// API host gets appended to capture-log.jsonl in this folder as it happens.
//
// When you're done clicking, press Ctrl+C in this terminal (or just close
// the browser window) to stop. Share capture-log.jsonl (or the relevant
// lines from it) back to continue wiring up the real adapter code.

import { chromium } from "playwright";
import { writeFileSync, appendFileSync } from "fs";

// Change this if you're capturing a different provider (Leader/Nexus use a
// different backend host -- check DevTools once to find it, same as before).
const START_URL = "https://app.factoreld.com";
const API_HOST_FILTER = "api.drivehos.app";
const LOG_FILE = "capture-log.jsonl";

writeFileSync(LOG_FILE, ""); // start fresh each run

function logEvent(event) {
  appendFileSync(LOG_FILE, JSON.stringify(event) + "\n");
  console.log(`[captured] ${event.method} ${event.url} -> ${event.status ?? "pending"}`);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pending = new Map();

  page.on("request", (request) => {
    if (!request.url().includes(API_HOST_FILTER)) return;
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
    if (!request.url().includes(API_HOST_FILTER)) return;
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
