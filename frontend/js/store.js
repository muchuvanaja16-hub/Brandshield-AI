(function (root) {
  const BS = root.BS || {};
  const KEY = "brandshield-ai-phase1-v1";

  function persist(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      state._persistError = String(err.message || err);
      return false;
    }
  }

  BS.loadState = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const seeded = BS.rescan(BS.createDemoSeed());
        persist(seeded);
        return seeded;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.brands) throw new Error("Saved workspace is missing brand data.");
      if (!parsed.detections || !parsed.detections.length) BS.rescan(parsed);
      parsed.demoMode = true;
      return parsed;
    } catch (err) {
      const fallback = BS.rescan(BS.createDemoSeed());
      fallback._loadError = "Could not read saved workspace (" + err.message + "). Demo seed was loaded instead.";
      persist(fallback);
      return fallback;
    }
  };

  BS.saveState = function (state) {
    persist(state);
    return state;
  };

  BS.resetDemo = function () {
    try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
    const seeded = BS.rescan(BS.createDemoSeed());
    persist(seeded);
    return seeded;
  };

  BS.upsertBrand = function (state, brand) {
    const existing = state.brands.findIndex(function (b) { return b.id === brand.id; });
    if (existing >= 0) state.brands[existing] = brand;
    else state.brands.push(brand);
    BS.rescan(state);
    persist(state);
    return state;
  };

  BS.removeBrand = function (state, brandId) {
    state.brands = state.brands.filter(function (b) { return b.id !== brandId; });
    state.officialSocial = state.officialSocial.filter(function (x) { return x.brandId !== brandId; });
    state.officialApps = state.officialApps.filter(function (x) { return x.brandId !== brandId; });
    BS.rescan(state);
    persist(state);
    return state;
  };

  BS.addAllow = function (state, observedId) {
    if (state.allowlist.indexOf(observedId) === -1) state.allowlist.push(observedId);
    BS.rescan(state);
    persist(state);
    return state;
  };

  BS.addOfficialSocial = function (state, row) {
    state.officialSocial.push(row);
    BS.rescan(state);
    persist(state);
    return state;
  };

  BS.addOfficialApp = function (state, row) {
    state.officialApps.push(row);
    BS.rescan(state);
    persist(state);
    return state;
  };

  BS.addObserved = function (state, row) {
    state.observed.push(row);
    BS.rescan(state);
    persist(state);
    return state;
  };

  BS.toggleAllow = function (state, observedId) {
    const i = state.allowlist.indexOf(observedId);
    if (i >= 0) state.allowlist.splice(i, 1);
    else state.allowlist.push(observedId);
    BS.rescan(state);
    persist(state);
    return state;
  };

  BS.updateCase = function (state, caseId, patch) {
    const item = state.cases.find(function (c) { return c.id === caseId; });
    if (!item) return state;
    Object.assign(item, patch);
    item.updatedAt = new Date().toISOString();
    persist(state);
    return state;
  };

  BS.addCase = function (state, detection) {
    const id = "CASE-" + new Date().getFullYear() + "-" + String(state.cases.length + 101).slice(-3);
    const row = {
      id: id,
      detectionId: detection.observedId,
      brandId: detection.brandId,
      campaignId: null,
      status: "open",
      title: detection.title,
      openedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [{ at: new Date().toISOString(), text: "Case opened from a simulated detection." }],
      actions: detection.nextActions.slice(0, 3),
      impact: { potentialAudience: null, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null }
    };
    state.cases.unshift(row);
    persist(state);
    return row;
  };

  BS.updateRules = function (state, rules) {
    state.scoringRules = Object.assign({}, state.scoringRules, rules);
    BS.rescan(state);
    persist(state);
    return state;
  };

  // ---------------------------------------------------------------------------
  // Phase 2 Flask API bridge. Demo mode keeps localStorage fully functional
  // when the backend is down. All helpers are no-op on network failure so the
  // workspace never breaks.
  // ---------------------------------------------------------------------------

  BS.apiBase = function () {
    return (window.BRANDSHIELD_API_BASE || "").replace(/\/+$/, "");
  };

  BS.apiFetch = function (path, opts) {
    if (typeof fetch !== "function") return Promise.reject(new Error("fetch not available"));
    const options = opts || {};
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && typeof options.body !== "string") {
      headers.set("Content-Type", "application/json");
      options.body = JSON.stringify(options.body);
    }
    options.headers = headers;
    options.credentials = options.credentials || "same-origin";
    const full = BS.apiBase() + path;
    return fetch(full, options).then(function (res) {
      const ct = res.headers.get("content-type") || "";
      const readBody = ct.indexOf("application/json") >= 0 ? res.json() : res.text();
      return readBody.then(function (body) {
        if (!res.ok) {
          const detail = (body && typeof body === "object" && body.detail) ? body.detail : (body || "Request failed (" + res.status + ")");
          const msg = Array.isArray(detail) ? detail.map(function (x) { return (x && x.msg) || "Invalid input"; }).join("; ") : String(detail);
          const err = new Error(msg);
          err.status = res.status;
          err.body = body;
          throw err;
        }
        return body;
      });
    });
  };

  BS.probeApi = function (state) {
    state.apiAvailable = false;
    state.apiInfo = null;
    if (typeof fetch !== "function") return Promise.resolve(false);
    const timeoutMs = 2000;
    let timedOut = false;
    const timer = setTimeout(function () { timedOut = true; }, timeoutMs);
    return BS.apiFetch("/api/health").then(function (body) {
      clearTimeout(timer);
      if (timedOut) return false;
      if (body && body.status === "ok") {
        state.apiAvailable = true;
        state.apiInfo = {
          service: body.service || "BrandShield AI",
          demo_mode: !!body.demo_mode,
          stack: body.stack || "",
          database_scheme: body.database_url_scheme || "",
          probedAt: new Date().toISOString(),
        };
        // Also best-effort fetch backend summary to supplement local counts.
        BS.apiFetch("/api/dashboard/summary").then(function (summary) {
          state.backendSummary = summary || null;
        }).catch(function () { state.backendSummary = null; });
        return true;
      }
      return false;
    }).catch(function () {
      clearTimeout(timer);
      state.apiAvailable = false;
      state.apiInfo = null;
      return false;
    });
  };

  BS.pushCandidate = function (state, candidate, assetType, platform) {
    if (!state.apiAvailable) return Promise.resolve(null);
    return BS.apiFetch("/api/scans", {
      method: "POST",
      body: { candidate: String(candidate || ""), asset_type: assetType || "website", platform: platform || "Manual submission" },
    }).catch(function () { return null; });
  };

  root.BS = BS;
  if (typeof module !== "undefined") module.exports = BS;
})(typeof window !== "undefined" ? window : globalThis);
