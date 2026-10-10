(function (root) {
  const BS = root.BS || {};
  const $ = BS.escapeHtml;

  function pill(kind, text) {
    return '<span class="pill pill-' + $(String(kind || "low").replace(/\s+/g, "-")) + '">' + $(text || kind) + "</span>";
  }

  function impactBox(impact) {
    const i = impact || {};
    function row(label, value, extra) {
      const show = value == null || value === "" ? "Unknown" : extra ? extra + String(value) : String(value);
      const note = (value == null || value === "") ? " — no reliable figure in this record" : "";
      return "<div><div class='metric-label'>" + $(label) + "</div><div><strong>" + $(show) + "</strong><span class='muted small'>" + $(note) + "</span></div></div>";
    }
    return '<div class="grid g-2">' +
      row("Potential audience / reach", i.potentialAudience) +
      row("Reported victims", i.reportedVictims) +
      row("Confirmed victims", i.confirmedVictims) +
      row("Reported / confirmed financial loss", (i.reportedFinancialLoss == null && i.confirmedFinancialLoss == null) ? null : "reported " + BS.unknown(i.reportedFinancialLoss) + " / confirmed " + BS.unknown(i.confirmedFinancialLoss)) +
      "</div><p class='muted small'>These four metrics stay separate. Demo records never invent confirmed victims or losses.</p>";
  }

  function sourceCard(s) {
    return '<article class="card"><div class="spread"><h3>' + $(s.name) + "</h3>" +
      pill(s.status, s.status) + "</div><p class='small muted'>" + $(s.note) + "</p>" +
      "<p class='small'>Last updated: " + $(s.lastUpdated ? BS.formatWhen(s.lastUpdated) : "Data Unavailable") + "</p></article>";
  }

  function empty(title, body) {
    return '<div class="empty"><strong>' + $(title) + "</strong><p>" + $(body) + "</p></div>";
  }

  BS.brandName = function (state, id) {
    const b = (state.brands || []).find(function (x) { return x.id === id; });
    return b ? b.name : "Unknown brand";
  };

  BS.renderDashboard = function (state) {
    const dets = state.detections || [];
    const byType = { social: 0, app: 0, website: 0 };
    const bySev = { high: 0, medium: 0, low: 0, "review-needed": 0 };
    dets.forEach(function (d) {
      byType[d.type] = (byType[d.type] || 0) + 1;
      bySev[d.classification] = (bySev[d.classification] || 0) + 1;
    });
    const assets = (state.officialSocial || []).length + (state.officialApps || []).length +
      state.brands.reduce(function (n, b) { return n + (b.domains || []).length; }, 0);
    const recent = dets.slice().sort(function (a, b) { return (b.observed.notedAt || "").localeCompare(a.observed.notedAt || ""); }).slice(0, 6);
    const hist = (state.scanHistory || []).slice(-6);
    const maxH = Math.max.apply(null, hist.map(function (h) { return h.high + h.medium; }).concat([1]));
    const casesOpen = (state.cases || []).filter(function (c) { return c.status === "open" || c.status === "investigating"; }).length;

    return '<p class="eyebrow">Workspace overview</p><p class="page-lead">Counts below are from the local demo dataset and the in-browser engine. They are not live scan results.</p>' +
      (state._loadError ? '<div class="notice err">' + $(state._loadError) + "</div>" : "") +
      '<div class="grid g-4">' +
      '<article class="card"><div class="metric-label">Monitored brands</div><div class="metric-value">' + state.brands.length + '</div><div class="muted small">Fictional demo brands</div></article>' +
      '<article class="card"><div class="metric-label">Official assets on file</div><div class="metric-value">' + assets + '</div><div class="muted small">Social, apps, and domains</div></article>' +
      '<article class="card"><div class="metric-label">Simulated detections</div><div class="metric-value">' + dets.length + '</div><div class="muted small">Last local run ' + $(BS.formatWhen(state.lastScanAt)) + "</div></article>" +
      '<article class="card"><div class="metric-label">Open investigations</div><div class="metric-value">' + casesOpen + '</div><div class="muted small">Not including resolved / FP</div></article></div>' +
      '<div class="grid g-2" style="margin-top:16px">' +
      '<article class="card"><h3>Detections by severity</h3>' +
      [["high", bySev.high], ["medium", bySev.medium], ["low", bySev.low], ["review-needed", bySev["review-needed"]]].map(function (row) {
        const pct = dets.length ? Math.round((row[1] / dets.length) * 100) : 0;
        return '<div class="spread" style="margin-top:10px"><span>' + pill(row[0], row[0]) + "</span><strong>" + row[1] + '</strong></div><div class="bar ' + row[0] + '"><i style="width:' + pct + '%"></i></div>';
      }).join("") +
      '</article><article class="card"><h3>By asset type</h3><p class="small muted">Social ' + byType.social + " · Apps " + byType.app + " · Websites " + byType.website + "</p>" +
      '<div class="chart">' + hist.map(function (h) {
        const hgt = Math.round(((h.high + h.medium) / maxH) * 100);
        return '<div class="col"><b style="height:' + hgt + '%"></b><span>' + $(h.at.slice(5, 10)) + "</span></div>";
      }).join("") + "</div><p class='small muted'>Bars show high+medium counts from simulated scan history.</p></article></div>" +
      '<div class="grid g-2" style="margin-top:16px"><article class="card"><div class="spread"><h3>Recent simulated detections</h3><a class="btn btn-sm btn-outline" href="#/social">Open monitoring</a></div>' +
      (recent.length ? '<div class="table-wrap"><table><thead><tr><th>Asset</th><th>Type</th><th>Risk</th><th>Confidence</th><th>Class</th></tr></thead><tbody>' +
        recent.map(function (d) {
          return "<tr><td><button class='linkish' data-open-case='" + $(d.observedId) + "'>" + $(d.title) + "</button><div class='small muted'>" + $(d.brandName) + "</div></td><td>" + $(d.type) + "</td><td>" + d.riskScore + "</td><td>" + d.confidence + "</td><td>" + pill(d.classification, d.classification) + "</td></tr>";
        }).join("") + "</tbody></table></div>" : empty("No detections", "Add sample assets or reset the demo.")) +
      '</article><article class="card"><h3>Source availability</h3><div class="stack">' + state.sources.map(sourceCard).join("") + "</div></article></div>";
  };

  function brandForm(b) {
    b = b || { name: "", description: "", website: "", domains: [], logoText: "", supportChannels: [] };
    return '<form id="brand-form" data-id="' + $(b.id || "") + '">' +
      '<div class="field"><label>Brand name</label><input name="name" required value="' + $(b.name || "") + '"></div>' +
      '<div class="field"><label>Description</label><textarea name="description">' + $(b.description || "") + "</textarea></div>" +
      '<div class="grid g-2"><div class="field"><label>Official website</label><input name="website" value="' + $(b.website || "") + '" placeholder="https://brand.example"></div>' +
      '<div class="field"><label>Logo initials (placeholder)</label><input name="logoText" maxlength="3" value="' + $(b.logoText || "") + '"></div></div>' +
      '<div class="field"><label>Official domains (comma separated)</label><input name="domains" value="' + $((b.domains || []).join(", ")) + '"></div>' +
      '<div class="field"><label>Support channels (comma separated)</label><input name="support" value="' + $((b.supportChannels || []).map(function (s) { return s.value; }).join(", ")) + '"></div>' +
      '<p class="small muted">Verification in demo mode is labeled simulated. Saving this form does not prove ownership.</p>' +
      '<button class="btn btn-primary" type="submit">Save brand profile</button></form>';
  }

  BS.renderBrands = function (state) {
    if (!state.brands.length) return empty("No brands yet", "Create a brand profile to start monitoring.");
    return '<p class="page-lead">Official inventory used by the local engine. Multiple accounts per brand are supported. Allowlisted assets are excluded from threat labeling.</p>' +
      '<div class="spread" style="margin-bottom:12px"><button class="btn btn-primary" id="new-brand">New brand profile</button></div>' +
      '<div class="grid g-3">' + state.brands.map(function (b) {
        const social = state.officialSocial.filter(function (s) { return s.brandId === b.id; });
        const apps = state.officialApps.filter(function (a) { return a.brandId === b.id; });
        return '<article class="card"><div class="row"><div class="avatar">' + $(b.logoText || "?") + "</div><div><h3>" + $(b.name) + "</h3>" +
          pill("simulated", b.verification.label) + '</div></div><p class="small muted">' + $(b.description) + "</p>" +
          '<p class="small">Website: ' + $(b.website) + "<br>Domains: " + $(b.domains.join(", ")) + "</p>" +
          "<p class='small'><strong>" + social.length + "</strong> official social · <strong>" + apps.length + "</strong> official apps</p>" +
          '<div class="row"><button class="btn btn-sm" data-edit-brand="' + $(b.id) + '">Edit</button>' +
          '<button class="btn btn-sm" data-add-social="' + $(b.id) + '">Add social</button>' +
          '<button class="btn btn-sm" data-add-app="' + $(b.id) + '">Add app</button></div>' +
          '<p class="small muted" style="margin-top:8px">' + $(b.verification.note) + "</p></article>";
      }).join("") + "</div>" +
      '<article class="card" style="margin-top:16px"><h3>Allowlist</h3><p class="small muted">Assets listed here are treated as legitimate exclusions, including demo false positives.</p>' +
      (state.allowlist.length ? "<ul>" + state.allowlist.map(function (id) {
        const o = state.observed.find(function (x) { return x.id === id; });
        return "<li>" + $(id) + " — " + $(o ? (o.username || o.name || o.host) : "missing record") +
          ' <button class="btn btn-sm" data-allow="' + $(id) + '">Remove</button></li>';
      }).join("") + "</ul>" : empty("Allowlist is empty", "Mark a detection as allowlisted from monitoring or investigation.")) + "</article>";
  };

  function detectionTable(state, type, filters) {
    let rows = (state.detections || []).filter(function (d) { return d.type === type; });
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter(function (d) { return (d.title + d.brandName + JSON.stringify(d.observed)).toLowerCase().indexOf(q) !== -1; });
    }
    if (filters.cls && filters.cls !== "all") rows = rows.filter(function (d) { return d.classification === filters.cls; });
    if (filters.brand && filters.brand !== "all") rows = rows.filter(function (d) { return d.brandId === filters.brand; });
    if (!rows.length) return empty("No matching records", "Try clearing filters, or this source has no sample rows.");
    return '<div class="table-wrap"><table><thead><tr><th>Asset</th><th>Brand it resembles</th><th>Risk</th><th>Confidence</th><th>Class</th><th></th></tr></thead><tbody>' +
      rows.map(function (d) {
        const extra = d.type === "website" ? $(d.observed.url || d.observed.host) : $(d.observed.username || d.observed.publisher || "");
        return "<tr><td><strong>" + $(d.title) + '</strong><div class="small muted">' + extra + "</div><div class='small'>" + pill("simulated", "simulated finding") + "</div></td>" +
          "<td>" + $(d.resembles) + "</td><td>" + d.riskScore + "</td><td>" + d.confidence + "</td><td>" + pill(d.classification, d.classification) + "</td>" +
          "<td><button class='btn btn-sm' data-detail='" + $(d.id) + "'>Evidence</button> " +
          "<button class='btn btn-sm' data-allow='" + $(d.observedId) + "'>Allowlist</button></td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function monitorChrome(state, type, title, blurb, unavailableId) {
    const src = state.sources.find(function (s) { return s.id === unavailableId; });
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const filters = { q: params.get("q") || "", cls: params.get("cls") || "all", brand: params.get("brand") || "all" };
    return '<p class="page-lead">' + $(blurb) + "</p>" +
      (src ? '<div class="notice warn"><strong>' + $(src.name) + " is unavailable.</strong> " + $(src.note) + "</div>" : "") +
      '<div class="filters">' +
      '<input id="filter-q" placeholder="Search" value="' + $(filters.q) + '">' +
      '<select id="filter-cls"><option value="all">All classes</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="review-needed">Review needed</option><option value="legitimate">Legitimate</option><option value="allowlisted">Allowlisted</option></select>' +
      '<select id="filter-brand"><option value="all">All brands</option>' + state.brands.map(function (b) { return '<option value="' + $(b.id) + '">' + $(b.name) + "</option>"; }).join("") + "</select>" +
      '<button class="btn btn-primary" id="apply-filters">Apply</button>' +
      '<button class="btn" id="add-observed">Add sample candidate</button></div>' +
      detectionTable(state, type, filters);
  }

  BS.renderSocial = function (state) {
    return monitorChrome(state, "social", "Social", "Local checks: username/name similarity, bio wording, off-brand links, and a labeled logo hint. This is not a live social-platform crawl.", "social-api");
  };
  BS.renderApps = function (state) {
    return monitorChrome(state, "app", "Apps", "Local checks: app name, publisher mismatch, listing wording, store URL text, simulated icon hint. Not a live app-store search.", "app-stores");
  };
  BS.renderWeb = function (state) {
    return monitorChrome(state, "website", "Web", "Local checks: hyphenation, extra characters, digit substitution, and misleading subdomains. Each row shows the official asset it resembles.", "domain-intel");
  };

  BS.renderInvestigate = function (state, caseId) {
    const selected = state.cases.find(function (c) { return c.id === (caseId || state._caseId); }) || state.cases[0];
    if (!state.cases.length) return empty("No cases", "Open a case from a detection.");
    const det = state.detections.find(function (d) { return d.observedId === selected.detectionId; });
    const related = state.cases.filter(function (c) { return selected.campaignId && c.campaignId === selected.campaignId; });
    return '<p class="page-lead">Human review workflow. Status changes are stored in this browser. Scores remain simulated.</p>' +
      '<div class="grid g-2"><article class="card"><h3>Cases</h3><div class="table-wrap"><table><thead><tr><th>ID</th><th>Title</th><th>Status</th></tr></thead><tbody>' +
      state.cases.map(function (c) {
        return "<tr><td><button class='linkish' data-case='" + $(c.id) + "'>" + $(c.id) + "</button></td><td>" + $(c.title) + '<div class="small muted">' + $(BS.brandName(state, c.brandId)) + "</div></td><td>" + pill(c.status, c.status) + "</td></tr>";
      }).join("") + "</tbody></table></div></article>" +
      '<article class="card"><div class="spread"><h3>' + $(selected.id) + "</h3>" + pill(selected.status, selected.status) + "</div>" +
      "<p><strong>" + $(selected.title) + "</strong></p>" +
      '<p class="small muted">Opened ' + $(BS.formatWhen(selected.openedAt)) + " · Updated " + $(BS.formatWhen(selected.updatedAt)) + "</p>" +
      (det ? "<p>Risk " + det.riskScore + " / 100 · Confidence " + det.confidence + " / 100 · " + pill(det.classification, det.classification) + "</p><ul class='evidence'>" + det.reasons.map(function (r) { return "<li>" + $(r) + "</li>"; }).join("") + "</ul>" : "<p class='muted'>Linked detection was not found.</p>") +
      "<h3>Impact (keep separate)</h3>" + impactBox(selected.impact) +
      "<h3>Related campaign</h3>" + (related.length ? "<ul>" + related.map(function (c) { return "<li>" + $(c.id) + " — " + $(c.title) + "</li>"; }).join("") + "</ul>" : "<p class='muted'>No campaign link.</p>") +
      "<h3>Recommended actions</h3><ul>" + (selected.actions || []).map(function (a) { return "<li>" + $(a) + "</li>"; }).join("") + "</ul>" +
      "<h3>Notes</h3><ul>" + (selected.notes || []).map(function (n) { return "<li><span class='small muted'>" + $(BS.formatWhen(n.at)) + "</span> " + $(n.text) + "</li>"; }).join("") + "</ul>" +
      '<form id="case-form" data-id="' + $(selected.id) + '"><div class="field"><label>Status</label><select name="status">' +
      ["open", "investigating", "resolved", "dismissed", "false-positive", "review-needed"].map(function (s) {
        return '<option value="' + s + '"' + (selected.status === s ? " selected" : "") + ">" + s + "</option>";
      }).join("") + '</select></div><div class="field"><label>Add note</label><textarea name="note" placeholder="Analyst note"></textarea></div>' +
      '<div class="field"><label>Campaign ID (optional)</label><input name="campaignId" value="' + $(selected.campaignId || "") + '"></div>' +
      '<button class="btn btn-primary" type="submit">Update case</button> ' +
      '<button class="btn" type="button" data-allow="' + $(selected.detectionId) + '">Mark asset allowlisted</button></form></article></div>';
  };

  BS.renderReports = function (state) {
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const q = (params.get("q") || "").toLowerCase();
    const cls = params.get("cls") || "all";
    const type = params.get("type") || "all";
    let rows = state.detections || [];
    if (q) rows = rows.filter(function (d) { return (d.title + d.brandName + d.classification).toLowerCase().indexOf(q) !== -1; });
    if (cls !== "all") rows = rows.filter(function (d) { return d.classification === cls; });
    if (type !== "all") rows = rows.filter(function (d) { return d.type === type; });
    return '<p class="page-lead">Search and export simulated findings. Print uses a simplified layout.</p>' +
      '<div class="filters"><input id="filter-q" value="' + $(params.get("q") || "") + '" placeholder="Search reports">' +
      '<select id="filter-cls"><option value="all">All classes</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="review-needed">Review needed</option></select>' +
      '<select id="filter-type"><option value="all">All types</option><option value="social">Social</option><option value="app">Apps</option><option value="website">Websites</option></select>' +
      '<button class="btn btn-primary" id="apply-report-filters">Filter</button>' +
      '<button class="btn" id="export-csv">Export CSV</button>' +
      '<button class="btn" id="print-report">Print summary</button></div>' +
      '<article class="card" id="print-area"><h3>BrandShield AI — simulated findings summary</h3>' +
      '<p class="small muted">Generated locally · ' + $(BS.formatWhen(new Date().toISOString())) + " · Demo mode</p>" +
      (rows.length ? '<div class="table-wrap"><table><thead><tr><th>Title</th><th>Type</th><th>Brand</th><th>Risk</th><th>Conf.</th><th>Class</th><th>Evidence</th></tr></thead><tbody>' +
        rows.map(function (d) {
          return "<tr><td>" + $(d.title) + "</td><td>" + $(d.type) + "</td><td>" + $(d.brandName) + "</td><td>" + d.riskScore + "</td><td>" + d.confidence + "</td><td>" + $(d.classification) + "</td><td class='small'>" + $(d.reasons[0] || "") + "</td></tr>";
        }).join("") + "</tbody></table></div>" : empty("No rows", "No findings match these filters.")) + "</article>";
  };

  BS.renderSettings = function (state) {
    const r = state.scoringRules;
    const cat = BS.checksCatalog();
    return '<p class="page-lead">Demo mode is always on for Phase 1. Scoring weights apply to the local engine only.</p>' +
      '<div class="notice">DEMO MODE uses fictional brands and simulated scores. Reset restores the original sample set and clears this browser’s saved edits.</div>' +
      '<div class="grid g-2"><article class="card"><h3>Scoring weights</h3><form id="rules-form">' +
      Object.keys(r).map(function (k) {
        return '<div class="field"><label>' + $(k) + '</label><input type="number" name="' + $(k) + '" value="' + r[k] + '"></div>';
      }).join("") +
      '<button class="btn btn-primary" type="submit">Recalculate scores</button></form>' +
      "<p class='small muted'>Risk is not confidence. Raising a weight increases how much that signal contributes to danger, not how complete the evidence is.</p></article>" +
      '<article class="card"><h3>Demo controls</h3><button class="btn btn-danger" id="reset-demo">Reset demo data</button>' +
      "<p class='small muted' style='margin-top:12px'>Persistence: browser localStorage. No account, email, or database is required.</p>" +
      "<h3>Implemented checks</h3><ul>" + cat.implemented.map(function (x) { return "<li>" + $(x) + "</li>"; }).join("") + "</ul>" +
      "<h3>Future integrations</h3><ul>" + cat.future.map(function (x) { return "<li>" + $(x) + "</li>"; }).join("") + "</ul></article></div>" +
      '<article class="card" style="margin-top:16px"><h3>Sources</h3><div class="grid g-2">' + state.sources.map(sourceCard).join("") + "</div></article>";
  };

  BS.detectionDetailHtml = function (d) {
    if (!d) return empty("Not found", "That detection is not in the current workspace.");
    return "<h2>" + $(d.title) + "</h2>" + pill("simulated", "simulated") + " " + pill(d.classification, d.classification) +
      "<p>Risk score <strong>" + d.riskScore + "</strong> (potential danger) · Confidence <strong>" + d.confidence + "</strong> (evidence strength)</p>" +
      "<p class='small muted'>" + $(d.method) + "</p><h3>Why this score</h3><ul>" + d.reasons.map(function (r) { return "<li>" + $(r) + "</li>"; }).join("") + "</ul>" +
      "<h3>Evidence</h3><ul>" + d.evidence.map(function (e) { return "<li><strong>" + $(e.label) + ":</strong> " + $(e.detail) + "</li>"; }).join("") + "</ul>" +
      "<h3>Missing information</h3>" + (d.missing.length ? "<ul>" + d.missing.map(function (m) { return "<li>" + $(m) + "</li>"; }).join("") + "</ul>" : "<p>None recorded.</p>") +
      "<h3>Recommended next actions</h3><ul>" + d.nextActions.map(function (m) { return "<li>" + $(m) + "</li>"; }).join("") + "</ul>" +
      '<button class="btn btn-primary" data-open-from-det="' + $(d.observedId) + '">Open / create investigation</button> ' +
      '<button class="btn" data-fp="' + $(d.observedId) + '">Report false positive</button>';
  };

  BS.modalHtml = function (inner) {
    return '<div class="modal-back" id="modal-back"><div class="modal" role="dialog">' + inner +
      '<div style="margin-top:14px"><button class="btn" id="close-modal">Close</button></div></div></div>';
  };

  BS.brandForm = brandForm;
  BS.csvFromDetections = function (rows) {
    const header = ["title", "type", "brand", "risk", "confidence", "classification", "reasons"];
    const lines = [header.join(",")].concat(rows.map(function (d) {
      return [d.title, d.type, d.brandName, d.riskScore, d.confidence, d.classification, (d.reasons || []).join("; ")].map(BS.csvEscape).join(",");
    }));
    return lines.join("\n");
  };

  root.BS = BS;
})(typeof window !== "undefined" ? window : globalThis);
