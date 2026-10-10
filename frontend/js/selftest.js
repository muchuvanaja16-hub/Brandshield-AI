/* Run: node frontend/js/selftest.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = __dirname;
const ctx = { console: console, module: { exports: {} } };
ctx.window = ctx;
ctx.globalThis = ctx;
function load(name) {
  vm.runInNewContext(fs.readFileSync(path.join(dir, name), "utf8"), ctx, { filename: name });
}
load("utils.js");
load("demo-data.js");
load("engine.js");

const BS = ctx.BS;
let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const seed = BS.rescan(BS.createDemoSeed());
const social = seed.observed.filter((x) => x.type === "social");
const apps = seed.observed.filter((x) => x.type === "app");
const webs = seed.observed.filter((x) => x.type === "website");
assert(seed.brands.length >= 3, "at least 3 brands");
assert(social.length >= 12, "at least 12 social profiles (" + social.length + ")");
assert(apps.length >= 10, "at least 10 apps (" + apps.length + ")");
assert(webs.filter((w) => !w.isOfficialSample).length >= 8, "at least 8 suspicious/lookalike domains");
assert(seed.cases.length >= 10, "at least 10 cases (" + seed.cases.length + ")");

const official = seed.detections.find((d) => d.observedId === "soc-01");
assert(official && official.classification === "legitimate", "official social is legitimate, not malicious");
assert(official.riskScore <= 18, "official social risk stays low");

const lure = seed.detections.find((d) => d.observedId === "soc-02");
assert(lure && lure.riskScore >= 45, "support impersonation has elevated risk (" + (lure && lure.riskScore) + ")");
assert(lure.confidence !== lure.riskScore, "confidence is tracked separately from risk");
assert(lure.evidence.length > 0 && lure.reasons.length > 0, "explainable evidence present");

const fp = seed.detections.find((d) => d.observedId === "soc-08");
assert(fp && fp.classification === "allowlisted" && fp.riskScore === 0, "false-positive allowlist is not treated as fraud");

const news = seed.detections.find((d) => d.observedId === "soc-05");
assert(news && (news.classification === "review-needed" || news.riskScore <= 45), "news/fan account is not auto-labeled high fraud");

const look = seed.detections.find((d) => d.observedId === "web-02");
assert(look && look.resembles.indexOf("aetherpay.example") !== -1, "lookalike domain shows official asset it resembles");
assert(look.riskScore >= 40, "hyphenated secure domain scores as suspicious");

const pub = seed.detections.find((d) => d.observedId === "app-03");
assert(pub && pub.classification !== "legitimate", "publisher mismatch is not treated as official");

const onlyName = BS.scoreObserved({
  id: "tmp-name",
  type: "social",
  brandId: "brand-aetherpay",
  platform: "X",
  username: "aetherpayfanclub",
  displayName: "AetherPay Fans",
  description: "We like the app.",
  url: "https://x.example/aetherpayfanclub",
  links: [],
  logoHint: "unknown",
  isOfficialSample: false
}, seed);
assert(onlyName.classification === "review-needed", "name similarity alone yields review-needed, not proven fraud");
assert(onlyName.riskScore <= 42, "name-only risk is capped");

assert(BS.similarity("AetherPay", "aetherpay") === 100, "normalization similarity");
assert(BS.similarity("aetherpay", "aetherp4y") >= 70, "lookalike handle similarity");

if (failed) {
  console.error(failed + " failing checks");
  process.exit(1);
}
console.log("All self-checks passed.");
