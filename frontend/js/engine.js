/* Modular local detection + explainable risk engine. Not a live scanner. */
(function (root) {
  const BS = root.BS || {};

  const TERMS = ["support", "official", "secure", "login", "verify", "refund", "claim", "bonus", "rewards", "helpdesk", "password", "wallet", "giveaway", "register"];

  function brandById(state, id) {
    return (state.brands || []).find(function (b) { return b.id === id; }) || null;
  }

  function officialNames(brand, state) {
    const names = [brand && brand.name];
    (state.officialSocial || []).forEach(function (s) {
      if (s.brandId === brand.id) names.push(s.username, s.displayName);
    });
    (state.officialApps || []).forEach(function (s) {
      if (s.brandId === brand.id) names.push(s.name, s.publisher);
    });
    return names.filter(Boolean);
  }

  function officialHandles(brand, state) {
    return (state.officialSocial || []).filter(function (s) { return s.brandId === brand.id; });
  }

  function officialPublishers(brand, state) {
    return (state.officialApps || []).filter(function (a) { return a.brandId === brand.id; }).map(function (a) { return a.publisher; });
  }

  function officialHosts(brand) {
    const hosts = [BS.hostFrom(brand.website)];
    (brand.domains || []).forEach(function (d) { hosts.push(BS.hostFrom(d)); });
    return hosts.filter(Boolean);
  }

  function termHits(text) {
    const lower = String(text || "").toLowerCase();
    return TERMS.filter(function (t) { return lower.indexOf(t) !== -1; });
  }

  function logoContribution(hint, weight) {
    if (hint === "matches-official") return { score: 0, conf: 18, reason: "Demo logo hint says the mark matches the official sample (simulated metadata, not pixel matching)." };
    if (hint === "similar-palette") return { score: Math.round(weight * 0.7), conf: 8, reason: "Demo logo hint: similar palette or layout. This is simulated metadata, not proof of copying." };
    if (hint === "distinct") return { score: 0, conf: 10, reason: "Demo logo hint: visual style looks distinct from the official sample." };
    return { score: 0, conf: 0, reason: "No reliable logo comparison is available." };
  }

  function domainSignals(obs, brand) {
    const host = (obs.host || BS.hostFrom(obs.url || "")).toLowerCase();
    const officials = officialHosts(brand);
    const evidence = [];
    let pattern = 0;
    let exactOfficial = false;
    officials.forEach(function (off) {
      if (!off || !host) return;
      if (host === off || BS.registrable(host) === BS.registrable(off)) {
        exactOfficial = true;
      }
      const label = host.split(".")[0];
      const offLabel = off.split(".")[0];
      const sim = BS.similarity(label, offLabel);
      if (sim >= 55 && host !== off) {
        pattern = Math.max(pattern, sim);
        evidence.push("Host label similarity " + sim + "% versus official host " + off + ".");
      }
      if (host.indexOf(offLabel) !== -1 && BS.registrable(host) !== BS.registrable(off)) {
        pattern = Math.max(pattern, 86);
        evidence.push("Official brand token appears in a different registrable domain (" + host + ").");
      }
      if (label === offLabel + "secure" || label.indexOf(offLabel + "-") === 0 || label.indexOf("-" + offLabel) !== -1) {
        pattern = Math.max(pattern, 90);
        evidence.push("Extra token or hyphen attached to the official label (e.g. support-, -secure).");
      }
      if (host.replace(/-/g, "") === off.replace(/-/g, "") && host !== off) {
        pattern = Math.max(pattern, 88);
        evidence.push("Hyphenation change versus official domain " + off + ".");
      }
    });
    if (/^(login|support|secure|verify|official)\./.test(host) && !exactOfficial) {
      pattern = Math.max(pattern, 75);
      evidence.push("Misleading prefix or subdomain language on a non-official host.");
    }
    return { pattern: exactOfficial ? 0 : pattern, exactOfficial: exactOfficial, evidence: evidence, host: host };
  }

  BS.classify = function (risk, confidence, flags) {
    if (flags.allowlisted) return "allowlisted";
    if (flags.official) return "legitimate";
    if (flags.nameOnly && risk > 0) return "review-needed";
    if (confidence < 35 && risk >= 25) return "review-needed";
    if (risk >= 70) return "high";
    if (risk >= 45) return "medium";
    if (risk >= 20) return "low";
    return "low";
  };

  BS.scoreObserved = function (obs, state) {
    const rules = state.scoringRules || BS.defaultRules;
    const brand = brandById(state, obs.brandId);
    const missing = [];
    const evidence = [];
    const reasons = [];
    const nextActions = [];
    const flags = { official: !!obs.isOfficialSample, allowlisted: (state.allowlist || []).indexOf(obs.id) !== -1 };

    if (!brand) {
      return {
        id: "det-" + obs.id,
        observedId: obs.id,
        type: obs.type,
        brandId: obs.brandId,
        title: obs.displayName || obs.name || obs.host || obs.url || obs.id,
        riskScore: 0,
        confidence: 10,
        riskLevel: "review-needed",
        classification: "review-needed",
        reasons: ["No matching brand profile was found for this record."],
        evidence: [],
        missing: ["Brand profile"],
        nextActions: ["Attach a brand profile before scoring."],
        simulated: true,
        observed: obs
      };
    }

    if (flags.allowlisted) {
      return {
        id: "det-" + obs.id,
        observedId: obs.id,
        type: obs.type,
        brandId: obs.brandId,
        brandName: brand.name,
        title: obs.displayName || obs.name || obs.host || obs.url,
        riskScore: 0,
        confidence: 80,
        riskLevel: "low",
        classification: "allowlisted",
        reasons: ["This asset is on the allowlist. Similarity to the brand is not treated as a threat."],
        evidence: [{ label: "Allowlist", detail: obs.id }],
        missing: [],
        nextActions: ["Keep documenting why it was excluded."],
        simulated: true,
        observed: obs,
        resembles: brand.name
      };
    }

    let risk = 0;
    let confidence = 18;
    let strongSignals = 0;
    let nameSim = 0;

    const names = officialNames(brand, state);
    const hostLabel = String(obs.host || BS.hostFrom(obs.url || "")).split(".")[0];
    const label = obs.username || obs.name || obs.displayName || hostLabel || obs.host || "";
    names.forEach(function (n) {
      nameSim = Math.max(nameSim, BS.similarity(label, n), BS.similarity(obs.displayName || "", n), BS.similarity(hostLabel, n));
    });

    if (nameSim) {
      evidence.push({ label: "Name / handle similarity", detail: nameSim + "% versus official brand references (text only)." });
      risk += Math.round((nameSim / 100) * (rules.nameWeight || 28));
      confidence += 12;
    } else missing.push("Comparable official name/handle");

    if (obs.type === "social") {
      const handles = officialHandles(brand, state);
      let handleSim = 0;
      handles.forEach(function (h) {
        handleSim = Math.max(handleSim, BS.similarity(obs.username, h.username));
        if (String(obs.username).toLowerCase() === String(h.username).toLowerCase() && obs.platform === h.platform) {
          flags.official = true;
        }
      });
      if (handleSim) {
        evidence.push({ label: "Username similarity", detail: handleSim + "% versus an official username on file." });
        risk += Math.round((handleSim / 100) * (rules.handleWeight || 18));
        confidence += 8;
      }
      const hits = termHits((obs.description || "") + " " + (obs.displayName || ""));
      if (hits.length) {
        const add = Math.min(rules.suspiciousTermWeight || 16, hits.length * 6);
        risk += add;
        strongSignals += 1;
        evidence.push({ label: "Suspicious wording", detail: "Terms often used in impersonation lures: " + hits.join(", ") + "." });
        reasons.push("Profile text uses wording commonly seen in support/refund/reward lures.");
        confidence += 10;
      }
      const badLink = (obs.links || []).some(function (link) {
        const host = BS.hostFrom(link);
        return host && officialHosts(brand).indexOf(host) === -1 && officialHosts(brand).indexOf(BS.registrable(host)) === -1;
      });
      if ((obs.links || []).length && badLink) {
        risk += rules.linkWeight || 14;
        strongSignals += 1;
        evidence.push({ label: "Off-brand link", detail: "Bio link host is not in the official domain list." });
        reasons.push("A linked URL does not match official domains on the brand profile.");
        nextActions.push("Open the URL only in a safe, authorized workflow — this demo does not fetch it.");
        confidence += 12;
      } else if (!(obs.links || []).length) missing.push("Profile links");
      if (!obs.description) missing.push("Profile description");
    }

    if (obs.type === "app") {
      const pubs = officialPublishers(brand, state);
      const pubMatch = pubs.some(function (p) { return BS.normalize(p) === BS.normalize(obs.publisher); });
      const nameHit = pubs.length && BS.similarity(obs.name, brand.name) >= 70;
      if (obs.publisher && !pubMatch && nameHit) {
        risk += rules.publisherMismatchWeight || 22;
        strongSignals += 1;
        evidence.push({ label: "Publisher mismatch", detail: "Publisher “" + obs.publisher + "” is not on the official publisher list." });
        reasons.push("App name resembles the brand, but the publisher does not match official records.");
        confidence += 16;
      } else if (pubMatch) {
        flags.official = flags.official || BS.similarity(obs.name, brand.name) >= 80;
        evidence.push({ label: "Publisher match", detail: obs.publisher + " matches an official publisher." });
        confidence += 14;
        risk = Math.max(0, risk - Math.abs(rules.officialExactBonus || 40) / 2);
      } else missing.push("Reliable publisher comparison");
      const hits = termHits(obs.description || "");
      if (hits.length) {
        risk += Math.min(rules.suspiciousTermWeight || 16, hits.length * 5);
        evidence.push({ label: "Listing wording", detail: hits.join(", ") });
        confidence += 8;
        strongSignals += 1;
      }
      if (!obs.storeUrl) missing.push("Store URL");
    }

    if (obs.type === "website") {
      const dom = domainSignals(obs, brand);
      if (dom.exactOfficial) {
        flags.official = true;
        evidence.push({ label: "Official domain", detail: dom.host + " matches an official host on the brand profile." });
        confidence += 20;
      } else if (dom.pattern) {
        const domainRisk = Math.round((dom.pattern / 100) * (rules.domainPatternWeight || 24));
        risk += domainRisk;
        if (dom.pattern >= 80) risk = Math.max(risk, 52);
        strongSignals += 1;
        dom.evidence.forEach(function (line) { evidence.push({ label: "Lookalike domain", detail: line }); });
        reasons.push("Domain pattern resembles official asset " + officialHosts(brand)[0] + ".");
        confidence += 16;
        nextActions.push("Compare the suspicious host to the official domain and do not treat spelling similarity as proof of fraud by itself.");
      } else missing.push("Domain pattern match");
    }

    const logo = logoContribution(obs.logoHint, rules.logoHintWeight || 8);
    if (logo.score) {
      risk += logo.score;
      evidence.push({ label: "Logo hint (simulated)", detail: logo.reason });
      confidence += logo.conf;
    } else {
      missing.push("Independent logo comparison");
      evidence.push({ label: "Logo hint (simulated)", detail: logo.reason });
    }

    if (flags.official) {
      risk = Math.max(0, Math.round(risk + (rules.officialExactBonus || -40)));
      risk = Math.min(risk, 18);
      confidence = Math.max(confidence, 72);
      reasons.unshift("This record matches an official sample asset. It is labeled legitimate — not malicious.");
      nextActions.push("Keep it on the official inventory; do not open a threat case unless new evidence appears.");
    }

    flags.nameOnly = strongSignals === 0 && nameSim >= 55 && !flags.official;
    if (flags.nameOnly) {
      risk = Math.min(risk, 42);
      reasons.push("Name or handle similarity is present, but similarity alone does not prove fraud. Human review is required.");
      nextActions.push("Look for publisher, domain, or lure-language evidence before escalating.");
      confidence = Math.min(confidence, 48);
    }

    if (!reasons.length && !flags.official) {
      reasons.push("Only weak or incomplete signals were available. A low score is not a guarantee of safety.");
      nextActions.push("Collect more metadata or dismiss if the asset is clearly unrelated.");
    }

    risk = Math.max(0, Math.min(100, Math.round(risk)));
    confidence = Math.max(5, Math.min(95, Math.round(confidence)));
    const classification = BS.classify(risk, confidence, flags);
    const riskLevel = classification === "high" || classification === "medium" || classification === "low"
      ? classification
      : (risk >= 70 ? "high" : risk >= 45 ? "medium" : "low");

    if (classification === "high") nextActions.push("Create or update an investigation case and capture evidence.");
    if (classification === "review-needed") nextActions.push("Queue for analyst review; do not auto-label as malicious.");

    return {
      id: "det-" + obs.id,
      observedId: obs.id,
      type: obs.type,
      brandId: obs.brandId,
      brandName: brand.name,
      title: obs.displayName || obs.name || obs.host || obs.url || label,
      riskScore: risk,
      confidence: confidence,
      riskLevel: riskLevel,
      classification: classification,
      reasons: reasons,
      evidence: evidence,
      missing: missing,
      nextActions: nextActions.filter(function (item, idx, arr) { return arr.indexOf(item) === idx; }),
      simulated: true,
      resembles: brand.name + (obs.type === "website" ? " (" + (officialHosts(brand)[0] || brand.website) + ")" : ""),
      observed: obs,
      method: "Local rule-based heuristic. Not a trained model. Not a live platform scan."
    };
  };

  BS.rescan = function (state) {
    const detections = (state.observed || []).map(function (obs) {
      return BS.scoreObserved(obs, state);
    });
    const counts = { high: 0, medium: 0, low: 0, review: 0 };
    detections.forEach(function (d) {
      if (d.classification === "high") counts.high += 1;
      else if (d.classification === "medium") counts.medium += 1;
      else if (d.classification === "review-needed") counts.review += 1;
      else counts.low += 1;
    });
    state.detections = detections;
    state.lastScanAt = new Date().toISOString();
    state.scanHistory = (state.scanHistory || []).concat([{
      at: state.lastScanAt,
      high: counts.high,
      medium: counts.medium,
      low: counts.low,
      review: counts.review,
      note: "Local rescan of in-memory sample and user records"
    }]).slice(-12);
    if (state.sources) {
      state.sources = state.sources.map(function (s) {
        if (s.id === "local-engine") return Object.assign({}, s, { lastUpdated: state.lastScanAt, status: "available" });
        return s;
      });
    }
    return state;
  };

  BS.checksCatalog = function () {
    return {
      implemented: [
        "Username / display-name / app-name similarity (normalized Levenshtein)",
        "Description and listing suspicious-term heuristics",
        "Off-brand bio links versus official domains",
        "App publisher mismatch versus official publishers",
        "Lookalike hosts: hyphens, substitutions, extra tokens, misleading subdomains",
        "Allowlist and official-sample exclusion",
        "Configurable weights in Settings"
      ],
      future: [
        "Authorized live social platform APIs",
        "Authorized app store search APIs",
        "WHOIS / certificate / DNS intelligence",
        "Pixel-level logo or icon matching",
        "Trained machine-learning classifiers"
      ]
    };
  };

  root.BS = BS;
  if (typeof module !== "undefined") module.exports = BS;
})(typeof window !== "undefined" ? window : globalThis);
