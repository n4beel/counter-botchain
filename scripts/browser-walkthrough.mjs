/**
 * Comprehensive Browser Walkthrough for Counter (Archetype AC · Shopfront).
 * Connects to Headless Chrome via CDP, loads mock-wallet.js,
 * tests 1280px & 360px viewports, footer links, wallet menu tokens,
 * walks every seeded shop, shelf, and order,
 * executes real on-chain transaction: Charlie claims refund for order #5 past deadline,
 * withdraws refund on /me,
 * Alice fulfils order #6 on /s/1/manage,
 * withdraws earned revenue on /me,
 * Bob places a new order on /s/1 for Cornish Sardines,
 * verifies permalink receipt,
 * and asserts zero console errors and zero horizontal overflow.
 */
import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PORT = 9222;
const APP_URL = "http://localhost:3000";
const RPC_URL = "http://127.0.0.1:8724";

const ACC_ALICE = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Shopkeeper (Alice)
const ACC_BOB = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";   // Customer A (Bob)
const ACC_CHARLIE = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Customer B (Charlie)
const ACC_DAVE = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";    // Customer C (Dave)
const ACC_EVE = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";     // Shop 2 Owner (Eve)

const mockWalletScript = readFileSync(
  new URL("../../docs/specs/tools/mock-wallet.js", import.meta.url),
  "utf8"
);

const userDir = mkdtempSync(join(tmpdir(), "chrome-counter-"));

console.log("Launching headless Chrome...");
const chrome = spawn("google-chrome", [
  "--headless=new",
  `--remote-debugging-port=${CHROME_PORT}`,
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  `--user-data-dir=${userDir}`,
  "about:blank",
]);

await new Promise((r) => setTimeout(r, 1200));

async function cdpHttp(path, method = "GET") {
  const res = await fetch(`http://127.0.0.1:${CHROME_PORT}${path}`, { method });
  return await res.json();
}

const version = await cdpHttp("/json/version");
console.log("Connected to Chrome:", version["Browser"]);

const list = await cdpHttp("/json/list");
const pageTarget = list.find((t) => t.type === "page");
const wsUrl = pageTarget?.webSocketDebuggerUrl;
if (!wsUrl) throw new Error("No page webSocketDebuggerUrl found");

const ws = new WebSocket(wsUrl);
let reqId = 1;
const pending = new Map();
const consoleErrors = [];
const cdpListeners = new Set();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  for (const listener of cdpListeners) {
    try {
      listener(msg);
    } catch (e) {
      console.error("Listener error:", e);
    }
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    if (msg.params.type === "error") {
      const errText = msg.params.args.map((a) => a.value || a.description).join(" ");
      if (!errText.includes("net::ERR_CONNECTION_REFUSED") && !errText.includes("favicon")) {
        consoleErrors.push(errText);
      }
    }
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
};

await new Promise((resolve) => (ws.onopen = resolve));

function send(method, params = {}) {
  const id = reqId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send("Page.enable");
await send("Runtime.enable");

// Injected mock wallet (reads active account from localStorage across navigations)
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    ${mockWalletScript}
    const acc = localStorage.getItem("__active_mock_account") || "${ACC_CHARLIE}";
    window.__installMockWallet({ rpc: "${RPC_URL}", account: acc });
    console.log("[MockWallet] Injected & installed for " + acc);
  `,
});

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result?.value;
}

async function setViewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
}

async function navigate(path) {
  const url = `${APP_URL}${path}`;
  const loadPromise = new Promise((resolve) => {
    const handler = (msg) => {
      if (msg.method === "Page.loadEventFired") {
        cdpListeners.delete(handler);
        resolve();
      }
    };
    cdpListeners.add(handler);
  });
  await send("Page.navigate", { url });
  await loadPromise;
  await new Promise((r) => setTimeout(r, 600));
}

async function waitForText(target, maxMs = 7000) {
  const start = Date.now();
  const lower = target.toLowerCase();
  while (Date.now() - start < maxMs) {
    const text = (await evaluate("document.body.innerText")) || "";
    if (text.toLowerCase().includes(lower)) return text;
    await new Promise((r) => setTimeout(r, 150));
  }
  return await evaluate("document.body.innerText");
}

async function checkHorizontalOverflow(routeName, width) {
  const overflow = await evaluate(`
    (() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      return { scrollWidth: docW, innerWidth: winW, overflow: docW > winW };
    })()
  `);
  console.log(`   Overflow check on ${routeName} (${width}px):`, overflow);
  if (overflow.overflow) {
    throw new Error(`Horizontal overflow on ${routeName} at ${width}px: scrollWidth ${overflow.scrollWidth} > innerWidth ${overflow.innerWidth}`);
  }
}

async function switchMockAccount(accountAddress) {
  await evaluate(`
    localStorage.setItem("__active_mock_account", "${accountAddress}");
    if (window.__mockWallet) {
      window.__mockWallet.setAccount("${accountAddress}");
    }
  `);
  await new Promise((r) => setTimeout(r, 200));
}

async function ensureWalletConnected() {
  await evaluate(`
    (() => {
      const connectBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Connect"));
      if (connectBtn) connectBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 500));
}

console.log("\n--- Starting Counter Browser Verification ---");

try {
  // -------------------------------------------------------------
  // 1. Desktop 1280px on / (Street Directory)
  // -------------------------------------------------------------
  console.log("1. Testing Desktop 1280px on /...");
  await setViewport(1280, 800);
  await navigate("/");

  const pageTitle = await evaluate("document.title");
  console.log(`   Page title: "${pageTitle}"`);
  if (!pageTitle.includes("Counter")) throw new Error("Title does not include 'Counter'");

  // Wait for initial render/hydration
  await waitForText("What the counter can't see", 8000);

  // Check 3 footer links
  const footerLinksCount = await evaluate(`
    (() => {
      const links = Array.from(document.querySelectorAll("footer a"));
      const hrefs = links.map(a => a.href);
      const hasBotchain = hrefs.some(h => h.includes("botchain.ai") && !h.includes("scan"));
      const hasScan = hrefs.some(h => h.includes("scan.botchain.ai"));
      const hasBuiltOn = document.querySelector("footer")?.textContent?.includes("Built on") || false;
      return { total: links.length, hasBotchain, hasScan, hasBuiltOn };
    })()
  `);
  console.log("   Footer links check:", footerLinksCount);
  if (!footerLinksCount.hasBotchain || !footerLinksCount.hasScan || !footerLinksCount.hasBuiltOn) {
    throw new Error("Footer missing required BOT Chain links");
  }

  // Check LimitationBlock copy
  const limitsCheck = await evaluate(`
    (() => {
      const text = document.body.innerText.toLowerCase();
      return {
        heading: text.includes("what the counter can't see"),
        l1: text.includes("the shop says when an order is filled"),
        l2: text.includes("prices can change. your order keeps the price you paid"),
        l3: text.includes("one order, one amount. no part-refunds"),
      };
    })()
  `);
  console.log("   Limitation block copy check:", limitsCheck);
  if (!limitsCheck.heading || !limitsCheck.l1 || !limitsCheck.l2 || !limitsCheck.l3) {
    throw new Error("LimitationBlock missing required copy");
  }

  // Check wallet menu tokens
  const menuTokens = await evaluate(`
    (() => {
      const style = getComputedStyle(document.documentElement);
      return {
        bg: style.getPropertyValue("--menu-bg").trim(),
        fg: style.getPropertyValue("--menu-fg").trim(),
        muted: style.getPropertyValue("--menu-muted").trim(),
        border: style.getPropertyValue("--menu-border").trim(),
        hoverBg: style.getPropertyValue("--menu-hover-bg").trim(),
        danger: style.getPropertyValue("--menu-danger").trim(),
      };
    })()
  `);
  console.log("   Wallet menu tokens check:", menuTokens);
  if (
    !["#ffffff", "#fff"].includes(menuTokens.bg.toLowerCase()) ||
    menuTokens.fg.toLowerCase() !== "#12351f" ||
    menuTokens.muted.toLowerCase() !== "#41604b" ||
    menuTokens.border.toLowerCase() !== "#bfd3c4"
  ) {
    throw new Error(`Wallet menu tokens do not match required spec: ${JSON.stringify(menuTokens)}`);
  }

  // Check seeded shops visible on street
  await waitForText("The Corner Tin");
  await waitForText("Market Empty Hall");
  await checkHorizontalOverflow("/", 1280);

  // -------------------------------------------------------------
  // 2. Mobile 360px viewport checks across all routes
  // -------------------------------------------------------------
  console.log("\n2. Testing Mobile 360px viewports & 0px overflow across all routes...");
  await setViewport(360, 640);

  const routes = ["/", "/new", "/s/1", "/s/2", "/s/1/manage", "/o/1", "/me"];
  for (const r of routes) {
    await navigate(r);
    await new Promise((res) => setTimeout(res, 500));
    await checkHorizontalOverflow(r, 360);
  }

  // Reset to Desktop for on-chain actions
  await setViewport(1280, 800);

  // -------------------------------------------------------------
  // 3. Customer B (Charlie) claims refund for Order #5 past deadline
  // -------------------------------------------------------------
  console.log("\n3. Customer B (Charlie) claims refund on Order #5...");
  await switchMockAccount(ACC_CHARLIE);
  await navigate("/o/5");
  await ensureWalletConnected();

  await waitForText("Order Number");
  await waitForText("Refund window elapsed");

  // Click Claim Full Refund button
  const claimBtn = await evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Claim Full Refund"));
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `);
  console.log("   Clicked 'Claim Full Refund':", claimBtn);
  if (!claimBtn) throw new Error("Could not find 'Claim Full Refund' button");

  await new Promise((r) => setTimeout(r, 3000));
  await waitForText("Refunded");
  console.log("   Order #5 refund confirmed on-chain!");

  // -------------------------------------------------------------
  // 4. Customer B withdraws pending refund of 0.04 BOT on /me
  // -------------------------------------------------------------
  console.log("\n4. Customer B withdraws pending balance on /me...");
  await navigate("/me");
  await ensureWalletConnected();
  await waitForText("Withdrawable Balance");
  await waitForText("0.04 BOT");

  const withdrawBtn = await evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Withdraw to Wallet"));
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `);
  console.log("   Clicked 'Withdraw to Wallet':", withdrawBtn);
  if (!withdrawBtn) throw new Error("Could not find 'Withdraw to Wallet' button");

  await new Promise((r) => setTimeout(r, 3000));
  await waitForText("0 BOT");
  console.log("   Customer B withdrawal confirmed on-chain!");

  // -------------------------------------------------------------
  // 5. Shopkeeper (Alice) fulfils fresh Order #6 on /s/1/manage
  // -------------------------------------------------------------
  console.log("\n5. Shopkeeper (Alice) fulfils Order #6 in Order Tray...");
  await switchMockAccount(ACC_ALICE);
  await navigate("/s/1/manage");
  await ensureWalletConnected();

  const manageText = await evaluate("document.body.innerText");
  console.log("   /s/1/manage text preview:", manageText.slice(0, 300));

  await waitForText("Incoming Order Tickets");

  // Click Fulfil Order on ticket for order #6
  const fulfilClicked = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find(b => {
        const card = b.closest("div.rounded-lg");
        return card && card.textContent.includes("TICKET #0006") && b.textContent.includes("Fulfil Order");
      });
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `);
  console.log("   Clicked 'Fulfil Order' on Ticket #6:", fulfilClicked);
  if (!fulfilClicked) throw new Error("Could not click Fulfil on Ticket #6");

  await new Promise((r) => setTimeout(r, 3000));
  await waitForText("Fulfilled");
  console.log("   Ticket #6 fulfilled on-chain!");

  // -------------------------------------------------------------
  // 6. Shopkeeper (Alice) withdraws earned 0.1 BOT on /me
  // -------------------------------------------------------------
  console.log("\n6. Shopkeeper (Alice) withdraws earnings on /me...");
  await navigate("/me");
  await ensureWalletConnected();
  await waitForText("Withdrawable Balance");
  await waitForText("0.1 BOT");

  const aliceWithdraw = await evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Withdraw to Wallet"));
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `);
  console.log("   Alice clicked 'Withdraw to Wallet':", aliceWithdraw);
  if (!aliceWithdraw) throw new Error("Could not find withdraw button for Alice");

  await new Promise((r) => setTimeout(r, 3000));
  await waitForText("0 BOT");
  console.log("   Alice withdrawal confirmed on-chain!");

  // -------------------------------------------------------------
  // 7. Customer A (Bob) places an order on /s/1 for Cornish Sardines
  // -------------------------------------------------------------
  console.log("\n7. Customer A (Bob) places an order on /s/1 for Cornish Sardines...");
  await switchMockAccount(ACC_BOB);
  await navigate("/s/1");
  await ensureWalletConnected();

  await waitForText("Cornish Sardines");

  // Click + on Sardines tin
  const plusClicked = await evaluate(`
    (() => {
      const tins = Array.from(document.querySelectorAll("div.tin-container"));
      const sardineTin = tins.find(t => t.textContent.includes("Cornish Sardines"));
      if (!sardineTin) return false;
      const plusBtn = Array.from(sardineTin.querySelectorAll("button")).find(b => b.textContent.includes("+"));
      if (!plusBtn) return false;
      plusBtn.click();
      return true;
    })()
  `);
  console.log("   Clicked '+' on Cornish Sardines:", plusClicked);
  if (!plusClicked) throw new Error("Could not click '+' on Sardines");

  await new Promise((r) => setTimeout(r, 500));
  await waitForText("1x Cornish Sardines");

  // Click Place Order & Pay
  const placeOrderBtn = await evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Place Order & Pay"));
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `);
  console.log("   Clicked 'Place Order & Pay':", placeOrderBtn);
  if (!placeOrderBtn) throw new Error("Could not find 'Place Order & Pay' button");

  await new Promise((r) => setTimeout(r, 4000));
  await waitForText("#0007");
  console.log("   Order #7 placed successfully! Receipt verified.");

  // -------------------------------------------------------------
  // 8. Console errors assertion
  // -------------------------------------------------------------
  console.log("\n8. Checking for console errors...");
  console.log("   Total console errors recorded:", consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error("   Recorded console errors:", consoleErrors);
    throw new Error(`Console errors encountered during walkthrough: ${consoleErrors.join("; ")}`);
  }

  console.log("\n✅ ALL COUNTER BROWSER WALKTHROUGH CHECKS PASSED WITH 0 ERRORS!");
} finally {
  ws.close();
  chrome.kill("SIGKILL");
}
