(function () {
  const NAV = [
    ["dashboard", "Dashboard", "#/dashboard", "Overview"],
    ["brands", "Brand Profiler", "#/brands", "Inventory"],
    ["social", "Social Media Monitoring", "#/social", "Monitoring"],
    ["apps", "App Store Monitoring", "#/apps", "Monitoring"],
    ["websites", "Website Monitoring", "#/websites", "Monitoring"],
    ["investigate", "Threat Investigation", "#/investigate", "Operations"],
    ["reports", "Alerts and Reports", "#/reports", "Operations"],
    ["settings", "Settings", "#/settings", "Operations"]
  ];

  const titles = {
    dashboard: "Dashboard",
    brands: "Brand Profiler",
    social: "Social Media Monitoring",
    apps: "App Store Monitoring",
    websites: "Website Monitoring",
    investigate: "Threat Investigation",
    reports: "Alerts and Reports",
    settings: "Settings"
  };

  let state = null;

  function route() {
    const hash = (location.hash || "#/dashboard").replace(/^#/, "");
    const path = hash.split("?")[0];
    const parts = path.split("/").filter(Boolean);
    return { name: parts[0] || "dashboard", extra: parts[1] };
  }

  function paintShell(active) {
    const navHtml = NAV.map(function (item, idx, arr) {
      const prev = idx ? arr[idx - 1][3] : "";
      const label = item[3] !== prev ? '<div class="side-label">' + item[3] + "</div>" : "";
      return label + '<a class="side-link' + (item[0] === active ? " active" : "") + '" href="' + item[2] + '">' + item[1] + "</a>";
    }).join("");
    document.getElementById("sidebar-nav").innerHTML = navHtml;
    document.getElementById("top-title").textContent = titles[active] || "BrandShield AI";
    document.querySelectorAll(".side-link").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#/" + active);
    });
  }

  function render() {
    if (!state) {
      document.getElementById("view").innerHTML = '<div class="error-box">Workspace failed to load.</div>';
      return;
    }
    const r = route();
    paintShell(r.name);
    const view = document.getElementById("view");
    BS.setLoading(true);
    try {
      if (r.name === "brands") view.innerHTML = BS.renderBrands(state);
      else if (r.name === "social") view.innerHTML = BS.renderSocial(state);
      else if (r.name === "apps") view.innerHTML = BS.renderApps(state);
      else if (r.name === "websites") view.innerHTML = BS.renderWeb(state);
      else if (r.name === "investigate") view.innerHTML = BS.renderInvestigate(state, r.extra);
      else if (r.name === "reports") view.innerHTML = BS.renderReports(state);
      else if (r.name === "settings") view.innerHTML = BS.renderSettings(state);
      else view.innerHTML = BS.renderDashboard(state);
      bindSelects();
    } catch (err) {
      view.innerHTML = '<div class="error-box"><strong>Could not render this view.</strong><p>' + BS.escapeHtml(err.message) + "</p></div>";
    }
    BS.setLoading(false);
  }

  function bindSelects() {
    const cls = document.getElementById("filter-cls");
    const brand = document.getElementById("filter-brand");
    const type = document.getElementById("filter-type");
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    if (cls && params.get("cls")) cls.value = params.get("cls");
    if (brand && params.get("brand")) brand.value = params.get("brand");
    if (type && params.get("type")) type.value = params.get("type");
  }

  function setHash(name, params) {
    const q = new URLSearchParams(params || {});
    const qs = q.toString();
    location.hash = "#/" + name + (qs ? "?" + qs : "");
  }

  function openModal(html) {
    document.getElementById("modal-root").innerHTML = BS.modalHtml(html);
  }
  function closeModal() {
    document.getElementById("modal-root").innerHTML = "";
  }

  function detectionByObserved(id) {
    return (state.detections || []).find(function (d) { return d.observedId === id; });
  }

  function ensureCase(observedId) {
    let c = state.cases.find(function (x) { return x.detectionId === observedId; });
    if (!c) {
      const det = detectionByObserved(observedId);
      if (!det) { BS.toast("No detection for that asset.", "err"); return null; }
      c = BS.addCase(state, det);
    }
    location.hash = "#/investigate/" + c.id;
    return c;
  }

  document.addEventListener("click", function (ev) {
    const t = ev.target.closest("[data-edit-brand],[data-add-social],[data-add-app],[data-allow],[data-detail],[data-case],[data-open-case],[data-open-from-det],[data-fp],#new-brand,#apply-filters,#add-observed,#apply-report-filters,#export-csv,#print-report,#reset-demo,#close-modal,#menu-btn,.modal-back");
    if (!t) return;

    if (t.id === "menu-btn") {
      document.getElementById("sidebar").classList.toggle("open");
      return;
    }
    if (t.id === "close-modal" || t.classList.contains("modal-back")) {
      if (t.classList.contains("modal-back") && ev.target.id !== "modal-back") return;
      closeModal();
      return;
    }
    if (t.id === "new-brand") {
      openModal("<h2>New brand</h2>" + BS.brandForm());
      return;
    }
    if (t.dataset.editBrand) {
      const b = state.brands.find(function (x) { return x.id === t.dataset.editBrand; });
      openModal("<h2>Edit brand</h2>" + BS.brandForm(b));
      return;
    }
    if (t.dataset.addSocial) {
      openModal('<h2>Official social account</h2><form id="os-form" data-brand="' + t.dataset.addSocial + '">' +
        '<div class="field"><label>Platform</label><input name="platform" required placeholder="X"></div>' +
        '<div class="field"><label>Username</label><input name="username" required></div>' +
        '<div class="field"><label>Profile URL</label><input name="url" placeholder="https://x.example/brand"></div>' +
        '<div class="field"><label>Display name</label><input name="displayName"></div>' +
        '<p class="small muted">Added to the official inventory. Status is user-declared, not independently verified.</p>' +
        '<button class="btn btn-primary" type="submit">Save</button></form>');
      return;
    }
    if (t.dataset.addApp) {
      openModal('<h2>Official mobile app</h2><form id="oa-form" data-brand="' + t.dataset.addApp + '">' +
        '<div class="field"><label>App name</label><input name="name" required></div>' +
        '<div class="field"><label>Publisher</label><input name="publisher" required></div>' +
        '<div class="field"><label>Store</label><input name="store" value="Demo Store A"></div>' +
        '<div class="field"><label>Store URL</label><input name="storeUrl"></div>' +
        '<button class="btn btn-primary" type="submit">Save</button></form>');
      return;
    }
    if (t.dataset.allow) {
      BS.toggleAllow(state, t.dataset.allow);
      BS.toast("Allowlist updated.");
      render();
      return;
    }
    if (t.dataset.detail) {
      const d = state.detections.find(function (x) { return x.id === t.dataset.detail; });
      openModal(BS.detectionDetailHtml(d));
      return;
    }
    if (t.dataset.case) {
      location.hash = "#/investigate/" + t.dataset.case;
      return;
    }
    if (t.dataset.openCase || t.dataset.openFromDet) {
      ensureCase(t.dataset.openCase || t.dataset.openFromDet);
      closeModal();
      return;
    }
    if (t.dataset.fp) {
      BS.addAllow(state, t.dataset.fp);
      const existing = state.cases.find(function (c) { return c.detectionId === t.dataset.fp; });
      if (existing) BS.updateCase(state, existing.id, { status: "false-positive" });
      else {
        const det = detectionByObserved(t.dataset.fp);
        if (det) {
          const created = BS.addCase(state, det);
          BS.updateCase(state, created.id, { status: "false-positive" });
        }
      }
      BS.toast("Recorded as false positive and allowlisted.");
      closeModal();
      render();
      return;
    }
    if (t.id === "apply-filters") {
      const name = route().name;
      setHash(name, {
        q: document.getElementById("filter-q").value,
        cls: document.getElementById("filter-cls").value,
        brand: document.getElementById("filter-brand").value
      });
      return;
    }
    if (t.id === "apply-report-filters") {
      setHash("reports", {
        q: document.getElementById("filter-q").value,
        cls: document.getElementById("filter-cls").value,
        type: document.getElementById("filter-type").value
      });
      return;
    }
    if (t.id === "export-csv") {
      const params = new URLSearchParams(location.hash.split("?")[1] || "");
      let rows = state.detections.slice();
      const q = (params.get("q") || "").toLowerCase();
      if (q) rows = rows.filter(function (d) { return (d.title + d.brandName).toLowerCase().indexOf(q) !== -1; });
      if (params.get("cls") && params.get("cls") !== "all") rows = rows.filter(function (d) { return d.classification === params.get("cls"); });
      if (params.get("type") && params.get("type") !== "all") rows = rows.filter(function (d) { return d.type === params.get("type"); });
      BS.downloadText("brandshield-demo-report.csv", BS.csvFromDetections(rows), "text/csv");
      BS.toast("CSV downloaded (simulated findings).");
      return;
    }
    if (t.id === "print-report") {
      window.print();
      return;
    }
    if (t.id === "reset-demo") {
      if (!confirm("Reset demo data? Brand edits in this browser will be cleared.")) return;
      state = BS.resetDemo();
      BS.toast("Demo workspace restored.", "ok");
      location.hash = "#/dashboard";
      render();
      return;
    }
    if (t.id === "add-observed") {
      const type = route().name === "apps" ? "app" : route().name === "websites" ? "website" : "social";
      openModal("<h2>Add sample candidate</h2><p class='small muted'>This record stays local. It is not fetched from the real " + type + " ecosystem.</p>" +
        '<form id="obs-form" data-type="' + type + '">' +
        '<div class="field"><label>Brand</label><select name="brandId">' + state.brands.map(function (b) { return '<option value="' + b.id + '">' + BS.escapeHtml(b.name) + "</option>"; }).join("") + "</select></div>" +
        (type === "social" ? '<div class="field"><label>Platform</label><input name="platform" value="X"></div><div class="field"><label>Username</label><input name="username" required></div><div class="field"><label>Display name</label><input name="displayName"></div><div class="field"><label>Description</label><textarea name="description"></textarea></div><div class="field"><label>Profile URL</label><input name="url"></div><div class="field"><label>Bio link</label><input name="link"></div>' : "") +
        (type === "app" ? '<div class="field"><label>App name</label><input name="name" required></div><div class="field"><label>Publisher</label><input name="publisher" required></div><div class="field"><label>Description</label><textarea name="description"></textarea></div><div class="field"><label>Store URL</label><input name="storeUrl"></div>' : "") +
        (type === "website" ? '<div class="field"><label>URL or domain</label><input name="url" required placeholder="https://lookalike.example"></div>' : "") +
        '<button class="btn btn-primary" type="submit">Score locally</button></form>');
    }
  });

  document.addEventListener("submit", function (ev) {
    const form = ev.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === "brand-form") {
      ev.preventDefault();
      const fd = new FormData(form);
      const id = form.getAttribute("data-id") || BS.uid("brand");
      const existing = state.brands.find(function (b) { return b.id === id; });
      const brand = {
        id: id,
        name: String(fd.get("name") || "").trim(),
        description: String(fd.get("description") || "").trim(),
        logoText: String(fd.get("logoText") || "B").slice(0, 3).toUpperCase(),
        logoNote: "Placeholder initials. Not a real trademark.",
        website: String(fd.get("website") || "").trim(),
        domains: String(fd.get("domains") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
        supportChannels: String(fd.get("support") || "").split(",").map(function (s) { return { type: "text", value: s.trim() }; }).filter(function (s) { return s.value; }),
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        verification: { status: "user-declared", label: "User-declared (not independently verified)", note: "Demo / local entry. BrandShield has not verified ownership." }
      };
      BS.upsertBrand(state, brand);
      closeModal();
      BS.toast("Brand profile saved.");
      render();
      return;
    }
    if (form.id === "os-form") {
      ev.preventDefault();
      const fd = new FormData(form);
      BS.addOfficialSocial(state, {
        id: BS.uid("os"),
        brandId: form.getAttribute("data-brand"),
        platform: String(fd.get("platform") || ""),
        username: String(fd.get("username") || ""),
        url: String(fd.get("url") || ""),
        displayName: String(fd.get("displayName") || fd.get("username") || "")
      });
      closeModal();
      BS.toast("Official social account added (user-declared).");
      render();
      return;
    }
    if (form.id === "oa-form") {
      ev.preventDefault();
      const fd = new FormData(form);
      BS.addOfficialApp(state, {
        id: BS.uid("oa"),
        brandId: form.getAttribute("data-brand"),
        name: String(fd.get("name") || ""),
        publisher: String(fd.get("publisher") || ""),
        store: String(fd.get("store") || ""),
        storeUrl: String(fd.get("storeUrl") || ""),
        logoText: "AP"
      });
      closeModal();
      BS.toast("Official app added (user-declared).");
      render();
      return;
    }
    if (form.id === "obs-form") {
      ev.preventDefault();
      const fd = new FormData(form);
      const type = form.getAttribute("data-type");
      const row = {
        id: BS.uid(type.slice(0, 3)),
        type: type,
        brandId: String(fd.get("brandId")),
        logoHint: "unknown",
        isOfficialSample: false,
        notedAt: new Date().toISOString()
      };
      if (type === "social") {
        row.platform = String(fd.get("platform") || "X");
        row.username = String(fd.get("username") || "");
        row.displayName = String(fd.get("displayName") || row.username);
        row.description = String(fd.get("description") || "");
        row.url = String(fd.get("url") || "");
        row.links = String(fd.get("link") || "") ? [String(fd.get("link"))] : [];
      }
      if (type === "app") {
        row.name = String(fd.get("name") || "");
        row.publisher = String(fd.get("publisher") || "");
        row.description = String(fd.get("description") || "");
        row.store = "Manual sample";
        row.storeUrl = String(fd.get("storeUrl") || "");
      }
      if (type === "website") {
        row.url = String(fd.get("url") || "");
        row.host = BS.hostFrom(row.url);
        row.title = row.host;
        row.notes = "User-entered sample";
      }
      BS.addObserved(state, row);
      closeModal();
      BS.toast("Candidate scored locally.");
      render();
      return;
    }
    if (form.id === "case-form") {
      ev.preventDefault();
      const fd = new FormData(form);
      const id = form.getAttribute("data-id");
      const item = state.cases.find(function (c) { return c.id === id; });
      const note = String(fd.get("note") || "").trim();
      const notes = (item.notes || []).slice();
      if (note) notes.push({ at: new Date().toISOString(), text: note });
      BS.updateCase(state, id, {
        status: String(fd.get("status")),
        campaignId: String(fd.get("campaignId") || "").trim() || null,
        notes: notes
      });
      if (String(fd.get("status")) === "false-positive" && item) BS.addAllow(state, item.detectionId);
      BS.toast("Case updated.");
      render();
      return;
    }
    if (form.id === "rules-form") {
      ev.preventDefault();
      const fd = new FormData(form);
      const rules = {};
      fd.forEach(function (v, k) { rules[k] = Number(v); });
      BS.updateRules(state, rules);
      BS.toast("Scores recalculated with the new weights.");
      render();
    }
  });

  window.addEventListener("hashchange", render);

  function paintSideFoot() {
    const el = document.querySelector(".side-foot");
    if (!el) return;
    let conn = "Local demo workspace<br>No login required";
    if (state && state.apiAvailable) {
      const info = state.apiInfo || {};
      const tag = info.demo_mode ? "Flask demo mode" : "Flask backend";
      const db = info.database_scheme ? (" · " + info.database_scheme) : "";
      conn = '<span style="color:var(--success)">● </span>' + BS.escapeHtml(tag) +
             db + "<br>" +
             "Probed " + BS.formatWhen(info.probedAt || new Date().toISOString());
    } else if (state && state.apiAvailable === false && state.apiInfo === null && state._apiProbed) {
      conn = '<span style="color:var(--muted)">○ </span>Offline (local demo only)<br>Flask backend not reachable';
    }
    el.innerHTML = conn;
  }

  const origRender = render;
  render = function () {
    origRender();
    paintSideFoot();
  };

  try {
    state = BS.loadState();
    if (!location.hash) location.hash = "#/dashboard";
    else render();
    // Phase 2: probe Flask backend in the background. If it responds, the UI
    // shows a connected badge and backend counts supplement the local demo.
    // If it is unreachable, localStorage-only demo mode stays intact.
    BS.probeApi(state).then(function () {
      state._apiProbed = true;
      paintSideFoot();
      const r = route();
      if (r.name === "dashboard" || r.name === "settings") render();
    });
  } catch (err) {
    document.getElementById("view").innerHTML = '<div class="error-box"><strong>Startup error</strong><p>' + BS.escapeHtml(err.message) + "</p></div>";
  }
})();
