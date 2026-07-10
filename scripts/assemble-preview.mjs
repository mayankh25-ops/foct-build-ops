/**
 * Assembles a single self-contained HTML preview of the FOCT app:
 * (run `npm run build && npm run start` first, then `node scripts/assemble-preview.mjs`;
 * the Scope tabs are captured live with Playwright — the chromium import path
 * below is this build environment's global install, adjust locally if needed)
 *
 * fetches each prerendered route from the local Next server, inlines the CSS
 * bundle (with fonts as data: URIs), strips JS, and wraps everything in a
 * minimal route-switcher viewer. Output: preview.html
 */
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const ROUTES = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/service-desk", label: "Service desk" },
  { path: "/service-desk/new", label: "Raise ticket" },
  { path: "/roster", label: "Roster" },
  { path: "/timesheets", label: "Timesheets" },
  { path: "/consumables", label: "Consumables" },
  { path: "/modules", label: "Module access" },
  { path: "/kiosk", label: "Kiosk" },
  { path: "/settings/appearance", label: "Appearance" },
  { path: "/support", label: "Mobile · Home" },
  { path: "/support/new", label: "Mobile · New" },
  { path: "/support/jobs", label: "Mobile · Jobs" },
];

const fetchText = async (p) => (await fetch(BASE + p)).text();
const fetchB64 = async (p) => {
  const buf = await (await fetch(BASE + p)).arrayBuffer();
  return Buffer.from(buf).toString("base64");
};

// ---- collect pages ----------------------------------------------------
const pages = [];
let cssHrefs = new Set();
let htmlClass = "";

for (const r of ROUTES) {
  const html = await fetchText(r.path);
  const cls = html.match(/<html[^>]*class="([^"]*)"/);
  if (cls) htmlClass = cls[1];
  for (const m of html.matchAll(/<link[^>]+href="(\/_next\/static\/css\/[^"]+)"/g)) {
    cssHrefs.add(m[1]);
  }
  let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
  body = body
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<link[^>]*>/g, "")
    .replace(/<next-route-announcer[\s\S]*?<\/next-route-announcer>/g, "");
  pages.push({ ...r, body });
}


// ---- Scope module: capture every tab live (Radix unmounts inactive tabs,
// so plain prerendered HTML only contains Overview) ----------------------
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
{
  // collect /scope's route-specific CSS chunk (it's no longer in ROUTES)
  const scopeHtml = await fetchText("/scope");
  for (const m of scopeHtml.matchAll(/<link[^>]+href="(\/_next\/static\/css\/[^"]+)"/g)) cssHrefs.add(m[1]);
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pg.goto(BASE + "/scope", { waitUntil: "networkidle" });
  await pg.waitForTimeout(500);
  const SCOPE_TABS = [
    ["Overview", "/scope"],
    ["Scope explorer", "/scope-explorer"],
    ["Weekly roster", "/scope-roster"],
    ["Day gantt", "/scope-gantt"],
    ["Periodic planner", "/scope-periodic"],
  ];
  const scopePages = [];
  for (const [tab, route] of SCOPE_TABS) {
    await pg.getByRole("tab", { name: tab }).click();
    await pg.waitForTimeout(400);
    if (tab === "Weekly roster") { // open the first drawer so the detail is visible
      await pg.locator("tr.sc-pos-row").first().click();
      await pg.waitForTimeout(250);
    }
    let body = await pg.evaluate(() => document.body.innerHTML);
    body = body
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<link[^>]*>/g, "")
      .replace(/<next-route-announcer[\s\S]*?<\/next-route-announcer>/g, "");
    scopePages.push({ path: route, label: "Scope · " + tab.replace("Scope explorer", "Explorer").replace("Weekly roster", "Roster").replace("Day gantt", "Gantt").replace("Periodic planner", "Periodic"), body });
  }
  await browser.close();
  // insert the scope pages after Service desk pages (index of /service-desk/new + 1)
  const at = pages.findIndex((p) => p.path === "/roster");
  pages.splice(at < 0 ? pages.length : at, 0, ...scopePages);
}

// ---- inline CSS + fonts ------------------------------------------------
let css = "";
for (const href of cssHrefs) css += await fetchText(href);

const fontUrls = [...new Set([...css.matchAll(/url\((\/_next\/static\/media\/[^)]+\.woff2)\)/g)].map((m) => m[1]))];
for (const u of fontUrls) {
  const b64 = await fetchB64(u);
  css = css.split(`url(${u})`).join(`url(data:font/woff2;base64,${b64})`);
}
// drop sourcemap comments
css = css.replace(/\/\*# sourceMappingURL=[^*]+\*\//g, "");

// ---- viewer ------------------------------------------------------------
const nav = pages
  .map(
    (p, i) =>
      `<button class="pv-tab${i === 0 ? " pv-on" : ""}" data-target="${p.path}">${p.label}</button>`
  )
  .join("");

const sections = pages
  .map(
    (p, i) =>
      `<section class="pv-page" id="pv-${p.path.slice(1)}" data-route="${p.path}"${i === 0 ? "" : " hidden"}>${p.body}</section>`
  )
  .join("\n");

const out = `<title>FOCT BuildingOps — live design preview</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${css}
/* ---- preview viewer chrome (outside the app's design system) ---- */
html, body { margin: 0; padding: 0; }
.pv-bar { position: sticky; top: 0; z-index: 90; display: flex; align-items: center; gap: 4px;
  padding: 10px 16px; background: #101828; overflow-x: auto; }
.pv-brand { color: #f9fafb; font: 600 14px/1 ui-sans-serif, system-ui, sans-serif; margin-right: 12px; white-space: nowrap; }
.pv-brand small { color: #98a2b3; font-weight: 400; margin-left: 8px; }
.pv-tab { border: 0; border-radius: 8px; padding: 8px 14px; background: transparent; color: #cbd2dc;
  font: 500 13px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; white-space: nowrap; }
.pv-tab:hover { background: #1d2939; color: #fff; }
.pv-tab.pv-on { background: #0e7569; color: #fff; }
.pv-var { font-size: 12px; padding: 7px 10px; }
.pv-var.pv-von { background: #f2f4f7; color: #101828; }
.pv-note { margin-left: auto; color: #98a2b3; font: 400 12px/1.3 ui-sans-serif, system-ui, sans-serif; white-space: nowrap; }
.pv-page > div { min-height: calc(100vh - 49px) !important; }
.pv-page .h-screen { height: calc(100vh - 49px) !important; }
@media (max-width: 720px) { .pv-note { display: none; } }
</style>
<div class="pv-bar" role="tablist" aria-label="App screens">
  <span class="pv-brand">FOCT BuildingOps<small>design review build</small></span>
  ${nav}
  <span style="width:1px;height:20px;background:#344054;margin:0 6px"></span>
  <span style="color:#98a2b3;font:500 11px/1 ui-sans-serif,system-ui;letter-spacing:.08em;white-space:nowrap">PALETTE</span>
  <button class="pv-var pv-tab pv-von" data-variant="current">Nature · default</button>
  <button class="pv-var pv-tab" data-variant="option-analytics">A · Analytics</button>
  <button class="pv-var pv-tab" data-variant="option-blush">B · Blush</button>
  <button class="pv-var pv-tab" data-variant="option-slate">C · Slate</button>
  <button class="pv-var pv-tab" data-variant="option-sunset">D · Sunset</button>
  <button class="pv-var pv-tab" data-variant="graphite">Graphite</button>
  <button class="pv-var pv-tab" data-variant="harbour">Harbour</button>
  <button class="pv-var pv-tab" data-variant="eucalypt">Eucalypt</button>
  <button class="pv-var pv-tab" data-variant="sandstone">Sandstone</button>
  <button class="pv-var pv-tab" data-variant="ink">Ink</button>
  <button class="pv-var pv-tab" data-variant="subzero">Subzero</button>
  <span class="pv-note">Static preview — run the repo for full interactivity</span>
</div>
${sections}
<script>
// carry the app's font-variable classes onto the root element
document.documentElement.className += " ${htmlClass}";

// palette variant switching: retheme every captured page via data-theme
const originals = new Map();
document.querySelectorAll(".pv-page [data-theme]").forEach((el) => originals.set(el, el.getAttribute("data-theme")));
const varBtns = [...document.querySelectorAll(".pv-var")];
varBtns.forEach((b) =>
  b.addEventListener("click", () => {
    const v = b.dataset.variant;
    if (v === "current") {
      originals.forEach((theme, el) => el.setAttribute("data-theme", theme));
      document.documentElement.removeAttribute("data-theme");
    } else {
      originals.forEach((_, el) => el.setAttribute("data-theme", v));
      document.documentElement.setAttribute("data-theme", v);
    }
    varBtns.forEach((x) => x.classList.toggle("pv-von", x === b));
  })
);

const tabs = [...document.querySelectorAll(".pv-tab")].filter((t) => !t.classList.contains("pv-var"));
const show = (route) => {
  document.querySelectorAll(".pv-page").forEach((s) => (s.hidden = s.dataset.route !== route));
  tabs.forEach((t) => t.classList.toggle("pv-on", t.dataset.target === route));
  window.scrollTo(0, 0);
};
tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.target)));

// intercept the app's internal links so sidebar navigation works
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href^='/']");
  if (!a) return;
  e.preventDefault();
  const route = a.getAttribute("href");
  if (document.querySelector(\`.pv-page[data-route='\${route}']\`)) show(route);
});

// Scope's in-page tab strip → jump between the captured tab pages
const SCOPE_TAB_ROUTES = { "Overview": "/scope", "Scope explorer": "/scope-explorer", "Weekly roster": "/scope-roster", "Day gantt": "/scope-gantt", "Periodic planner": "/scope-periodic" };
document.addEventListener("click", (e) => {
  const b = e.target.closest("[role='tab']");
  if (!b || !b.closest(".pv-page")) return;
  const route = SCOPE_TAB_ROUTES[b.textContent.trim()];
  if (route && document.querySelector(\`.pv-page[data-route='\${route}']\`)) show(route);
});

// ---- live clocks (dashboard hero + kiosk) + PIN pad emulation ----
try {
  const kiosk = document.getElementById("pv-kiosk");
  const clocks = [...document.querySelectorAll(".pv-page p")]
    .filter((p) => p.textContent.includes("--:--"))
    .map((p) => ({ p, date: p.nextElementSibling, kiosk: !!p.closest("#pv-kiosk") }));
  const tick = () => {
    const now = new Date();
    for (const c of clocks) {
      c.p.textContent = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: !c.kiosk });
      if (c.date && c.date.tagName === "P")
        c.date.textContent = now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
    }
  };
  tick();
  setInterval(tick, 1000);

  let pin = "";
  const dots = [...kiosk.querySelectorAll("div[aria-label='PIN entry'] > span")].filter((s) => s.getAttribute("aria-hidden"));
  const actions = [...kiosk.querySelectorAll("button")].filter((b) => /^Check (in|out)$/.test(b.textContent.trim()));
  const paint = () => {
    dots.forEach((d, i) => {
      d.classList.toggle("bg-accent", i < pin.length);
      d.classList.toggle("bg-hover", i >= pin.length);
    });
    actions.forEach((b) => (b.disabled = pin.length !== 4));
  };
  kiosk.querySelectorAll("button").forEach((b) => {
    const t = b.textContent.trim();
    if (/^[0-9]$/.test(t)) b.addEventListener("click", () => { if (pin.length < 4) { pin += t; paint(); } });
    if (t === "Clear") b.addEventListener("click", () => { pin = ""; paint(); });
    if (b.getAttribute("aria-label") === "Delete last digit") b.addEventListener("click", () => { pin = pin.slice(0, -1); paint(); });
  });
  const names = { "1234": "Marcus", "2345": "Leila", "3456": "Sofia" };
  actions.forEach((b) =>
    b.addEventListener("click", () => {
      const inOut = b.textContent.trim() === "Check in" ? "checked in" : "checked out";
      const name = names[pin] ? ", " + names[pin] : "";
      const time = new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
      const main = kiosk.querySelector("main");
      const prev = main.innerHTML;
      main.innerHTML = \`<div class="flex w-full max-w-xl flex-col items-center text-center" style="margin:auto">
        <span class="flex size-24 items-center justify-center rounded-pill bg-success-subtle">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-success-text"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
        </span>
        <h1 class="mt-8 font-display text-display text-fg">You’re \${inOut}\${name}</h1>
        <p class="mt-3 text-title-3 font-normal text-fg-secondary">Recorded at \${time} · your supervisor can see you’re on site.</p>
        <button class="pv-done flex min-h-[5.5rem] w-full max-w-xs items-center justify-center gap-4 rounded-card px-8 font-display text-title-1 font-semibold border border-edge bg-surface text-fg shadow-card mt-12">Done</button>
      </div>\`;
      main.querySelector(".pv-done").addEventListener("click", () => { main.innerHTML = prev; location.reload(); });
      pin = "";
    })
  );
  paint();
} catch (e) { /* kiosk emulation is best-effort */ }
</script>
`;

writeFileSync(process.env.PREVIEW_OUT ?? "preview.html", out);
console.log("bytes:", out.length, "fonts inlined:", fontUrls.length, "pages:", pages.length);
