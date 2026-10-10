/* Fictional demo workspace only. Domains use .example. No real brands or victims. */
(function (root) {
  const BS = root.BS || {};

  BS.defaultRules = {
    nameWeight: 28,
    handleWeight: 18,
    descriptionWeight: 12,
    suspiciousTermWeight: 16,
    linkWeight: 14,
    publisherMismatchWeight: 22,
    domainPatternWeight: 24,
    logoHintWeight: 8,
    officialExactBonus: -40
  };

  BS.defaultSources = function (updatedAt) {
    return [
      { id: "local-engine", name: "Local detection engine", status: "available", lastUpdated: updatedAt, note: "Runs in the browser on sample and user-entered records." },
      { id: "social-api", name: "Social platform APIs", status: "unavailable", lastUpdated: null, note: "Not connected. Profiles below are demo samples, not live crawl results." },
      { id: "app-stores", name: "App store listings", status: "unavailable", lastUpdated: null, note: "Not connected. App rows are demo samples, not live store search." },
      { id: "domain-intel", name: "Domain intelligence / WHOIS", status: "unavailable", lastUpdated: null, note: "Not connected. Lookalike domains are authored demo records." }
    ];
  };

  BS.createDemoSeed = function () {
    const t0 = "2026-10-01T09:00:00.000Z";
    const t1 = "2026-10-06T11:15:00.000Z";
    const t2 = "2026-10-08T16:40:00.000Z";
    const t3 = "2026-10-09T18:05:00.000Z";

    const brands = [
      {
        id: "brand-aetherpay",
        name: "AetherPay",
        description: "Fictional consumer payments app used only for this demo.",
        logoText: "AP",
        logoNote: "Placeholder initials. Not a real trademark.",
        website: "https://aetherpay.example",
        domains: ["aetherpay.example", "pay.aetherpay.example"],
        supportChannels: [
          { type: "email", value: "support@aetherpay.example" },
          { type: "url", value: "https://aetherpay.example/help" }
        ],
        createdAt: t0,
        verification: { status: "simulated-demo", label: "Simulated demo allowlist", note: "Demo mode only. Not independently verified." }
      },
      {
        id: "brand-lumenmart",
        name: "LumenMart",
        description: "Fictional retail marketplace used only for this demo.",
        logoText: "LM",
        logoNote: "Placeholder initials. Not a real trademark.",
        website: "https://lumenmart.example",
        domains: ["lumenmart.example", "shop.lumenmart.example"],
        supportChannels: [
          { type: "email", value: "help@lumenmart.example" },
          { type: "url", value: "https://lumenmart.example/support" }
        ],
        createdAt: t0,
        verification: { status: "simulated-demo", label: "Simulated demo allowlist", note: "Demo mode only. Not independently verified." }
      },
      {
        id: "brand-novahealth",
        name: "NovaHealth",
        description: "Fictional telehealth service used only for this demo.",
        logoText: "NH",
        logoNote: "Placeholder initials. Not a real trademark.",
        website: "https://novahealth.example",
        domains: ["novahealth.example", "care.novahealth.example"],
        supportChannels: [
          { type: "email", value: "care@novahealth.example" },
          { type: "phone", value: "+1-555-0107 (fictional)" }
        ],
        createdAt: t0,
        verification: { status: "simulated-demo", label: "Simulated demo allowlist", note: "Demo mode only. Not independently verified." }
      }
    ];

    const officialSocial = [
      { id: "os-ap-x", brandId: "brand-aetherpay", platform: "X", username: "aetherpay", url: "https://x.example/aetherpay", displayName: "AetherPay" },
      { id: "os-ap-ig", brandId: "brand-aetherpay", platform: "Instagram", username: "aetherpay", url: "https://instagram.example/aetherpay", displayName: "AetherPay" },
      { id: "os-lm-x", brandId: "brand-lumenmart", platform: "X", username: "lumenmart", url: "https://x.example/lumenmart", displayName: "LumenMart" },
      { id: "os-lm-fb", brandId: "brand-lumenmart", platform: "Facebook", username: "LumenMartOfficial", url: "https://facebook.example/LumenMartOfficial", displayName: "LumenMart" },
      { id: "os-nh-x", brandId: "brand-novahealth", platform: "X", username: "novahealth", url: "https://x.example/novahealth", displayName: "NovaHealth" },
      { id: "os-nh-ig", brandId: "brand-novahealth", platform: "Instagram", username: "novahealthcare", url: "https://instagram.example/novahealthcare", displayName: "NovaHealth Care" }
    ];

    const officialApps = [
      { id: "oa-ap-1", brandId: "brand-aetherpay", name: "AetherPay", publisher: "AetherPay Ltd", store: "Demo Store A", storeUrl: "https://apps.example/aetherpay", logoText: "AP" },
      { id: "oa-ap-2", brandId: "brand-aetherpay", name: "AetherPay Business", publisher: "AetherPay Ltd", store: "Demo Store A", storeUrl: "https://apps.example/aetherpay-business", logoText: "AP" },
      { id: "oa-lm-1", brandId: "brand-lumenmart", name: "LumenMart Shop", publisher: "LumenMart Commerce", store: "Demo Store A", storeUrl: "https://apps.example/lumenmart", logoText: "LM" },
      { id: "oa-nh-1", brandId: "brand-novahealth", name: "NovaHealth", publisher: "NovaHealth PBC", store: "Demo Store B", storeUrl: "https://apps.example/novahealth", logoText: "NH" },
      { id: "oa-nh-2", brandId: "brand-novahealth", name: "NovaHealth Clinician", publisher: "NovaHealth PBC", store: "Demo Store B", storeUrl: "https://apps.example/novahealth-clinician", logoText: "NH" }
    ];

    const observed = [
      { id: "soc-01", type: "social", brandId: "brand-aetherpay", platform: "X", username: "aetherpay", displayName: "AetherPay", description: "Official AetherPay updates.", url: "https://x.example/aetherpay", links: ["https://aetherpay.example"], logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "soc-02", type: "social", brandId: "brand-aetherpay", platform: "X", username: "aetherpay_help", displayName: "AetherPay Support", description: "Official support. Verify your wallet and claim a bonus at aetherpay-secure.example", url: "https://x.example/aetherpay_help", links: ["https://aetherpay-secure.example/login"], logoHint: "similar-palette", isOfficialSample: false, notedAt: t2 },
      { id: "soc-03", type: "social", brandId: "brand-aetherpay", platform: "Instagram", username: "aetherp4y", displayName: "Aether Pay", description: "Payments made simple. DM for login help.", url: "https://instagram.example/aetherp4y", links: ["https://aetherp4y.example"], logoHint: "unknown", isOfficialSample: false, notedAt: t2 },
      { id: "soc-04", type: "social", brandId: "brand-aetherpay", platform: "Facebook", username: "OfficialAetherPayCare", displayName: "AetherPay Care Official", description: "Customer care — reset password and confirm payment.", url: "https://facebook.example/OfficialAetherPayCare", links: ["https://support-aetherpay.example"], logoHint: "similar-palette", isOfficialSample: false, notedAt: t3 },
      { id: "soc-05", type: "social", brandId: "brand-aetherpay", platform: "X", username: "aether_payments_news", displayName: "Aether Payments News", description: "Independent news about digital payments. Not affiliated.", url: "https://x.example/aether_payments_news", links: [], logoHint: "distinct", isOfficialSample: false, notedAt: t1 },
      { id: "soc-06", type: "social", brandId: "brand-lumenmart", platform: "X", username: "lumenmart", displayName: "LumenMart", description: "Shop LumenMart.", url: "https://x.example/lumenmart", links: ["https://lumenmart.example"], logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "soc-07", type: "social", brandId: "brand-lumenmart", platform: "Instagram", username: "lumenmart_offers", displayName: "LumenMart Offers", description: "Flash rewards. Claim your voucher. Official store login.", url: "https://instagram.example/lumenmart_offers", links: ["https://lumenmart-offers.example/claim"], logoHint: "similar-palette", isOfficialSample: false, notedAt: t2 },
      { id: "soc-08", type: "social", brandId: "brand-lumenmart", platform: "Facebook", username: "lumen_marketplace", displayName: "Lumen Marketplace", description: "A different fictional marketplace that happens to look similar in name.", url: "https://facebook.example/lumen_marketplace", links: ["https://lumen-marketplace.example"], logoHint: "distinct", isOfficialSample: false, notedAt: t1 },
      { id: "soc-09", type: "social", brandId: "brand-lumenmart", platform: "X", username: "lumenmart_help", displayName: "LumenMart Help", description: "Need help with an order? We never ask for passwords.", url: "https://x.example/lumenmart_help", links: ["https://lumenmart.example/support"], logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "soc-10", type: "social", brandId: "brand-novahealth", platform: "X", username: "novahealth", displayName: "NovaHealth", description: "Fictional telehealth updates.", url: "https://x.example/novahealth", links: ["https://novahealth.example"], logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "soc-11", type: "social", brandId: "brand-novahealth", platform: "Instagram", username: "novahealth_refunds", displayName: "NovaHealth Refunds", description: "Verify identity to receive your refund. Secure portal.", url: "https://instagram.example/novahealth_refunds", links: ["https://novahealth-refund.example"], logoHint: "unknown", isOfficialSample: false, notedAt: t3 },
      { id: "soc-12", type: "social", brandId: "brand-novahealth", platform: "Facebook", username: "nova_healthtips", displayName: "Nova Health Tips", description: "Wellness blog. Not a clinic and not affiliated with NovaHealth.", url: "https://facebook.example/nova_healthtips", links: [], logoHint: "distinct", isOfficialSample: false, notedAt: t1 },
      { id: "soc-13", type: "social", brandId: "brand-novahealth", platform: "X", username: "novahea1th", displayName: "NovaHealth Care", description: "Book appointments and login to your patient portal.", url: "https://x.example/novahea1th", links: ["https://novahea1th.example/login"], logoHint: "similar-palette", isOfficialSample: false, notedAt: t2 },
      { id: "soc-14", type: "social", brandId: "brand-aetherpay", platform: "TikTok", username: "aetherpay_official", displayName: "AetherPay Official", description: "Giveaway: register to claim rewards.", url: "https://tiktok.example/aetherpay_official", links: ["https://aetherpay-login.example"], logoHint: "unknown", isOfficialSample: false, notedAt: t3 },

      { id: "app-01", type: "app", brandId: "brand-aetherpay", name: "AetherPay", publisher: "AetherPay Ltd", store: "Demo Store A", storeUrl: "https://apps.example/aetherpay", description: "Send and receive demo payments.", logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "app-02", type: "app", brandId: "brand-aetherpay", name: "AetherPay Business", publisher: "AetherPay Ltd", store: "Demo Store A", storeUrl: "https://apps.example/aetherpay-business", description: "Business wallets for the demo brand.", logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "app-03", type: "app", brandId: "brand-aetherpay", name: "Aether Pay Secure Wallet", publisher: "AetherPay Team", store: "Demo Store C", storeUrl: "https://apps.example/aether-pay-secure", description: "Secure login and verify your account to unlock rewards.", logoHint: "similar-palette", isOfficialSample: false, notedAt: t2 },
      { id: "app-04", type: "app", brandId: "brand-aetherpay", name: "AetherPay Support Chat", publisher: "Helpdesk Labs", store: "Demo Store C", storeUrl: "https://apps.example/aetherpay-support-chat", description: "Chat with official support and reset passwords.", logoHint: "unknown", isOfficialSample: false, notedAt: t3 },
      { id: "app-05", type: "app", brandId: "brand-lumenmart", name: "LumenMart Shop", publisher: "LumenMart Commerce", store: "Demo Store A", storeUrl: "https://apps.example/lumenmart", description: "Shop the fictional marketplace.", logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "app-06", type: "app", brandId: "brand-lumenmart", name: "LumenMart Rewards", publisher: "LM Offers LLC", store: "Demo Store C", storeUrl: "https://apps.example/lumenmart-rewards", description: "Claim bonus vouchers. Official LumenMart rewards.", logoHint: "similar-palette", isOfficialSample: false, notedAt: t2 },
      { id: "app-07", type: "app", brandId: "brand-lumenmart", name: "Lumen Mart Shop", publisher: "Unknown Publisher", store: "Demo Store C", storeUrl: "https://apps.example/lumen-mart-shop", description: "Shopping app with similar branding.", logoHint: "unknown", isOfficialSample: false, notedAt: t2 },
      { id: "app-08", type: "app", brandId: "brand-novahealth", name: "NovaHealth", publisher: "NovaHealth PBC", store: "Demo Store B", storeUrl: "https://apps.example/novahealth", description: "Fictional patient app.", logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "app-09", type: "app", brandId: "brand-novahealth", name: "NovaHealth Clinician", publisher: "NovaHealth PBC", store: "Demo Store B", storeUrl: "https://apps.example/novahealth-clinician", description: "Clinician companion for the demo brand.", logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "app-10", type: "app", brandId: "brand-novahealth", name: "Nova Health Care+", publisher: "Care Plus Apps", store: "Demo Store C", storeUrl: "https://apps.example/nova-health-care-plus", description: "Book visits and verify insurance in our secure portal.", logoHint: "similar-palette", isOfficialSample: false, notedAt: t3 },
      { id: "app-11", type: "app", brandId: "brand-lumenmart", name: "LumenMart Helper", publisher: "LumenMart Commerce", store: "Demo Store A", storeUrl: "https://apps.example/lumenmart-helper", description: "Order tracking helper published by the official demo publisher.", logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },

      { id: "web-01", type: "website", brandId: "brand-aetherpay", url: "https://aetherpay.example", host: "aetherpay.example", title: "AetherPay", notes: "Official demo domain", logoHint: "matches-official", isOfficialSample: true, notedAt: t1 },
      { id: "web-02", type: "website", brandId: "brand-aetherpay", url: "https://aetherpay-secure.example/login", host: "aetherpay-secure.example", title: "AetherPay Secure Login", notes: "Hyphen + security bait", logoHint: "unknown", isOfficialSample: false, notedAt: t2 },
      { id: "web-03", type: "website", brandId: "brand-aetherpay", url: "https://aetherp4y.example", host: "aetherp4y.example", title: "AetherPay", notes: "Character substitution", logoHint: "unknown", isOfficialSample: false, notedAt: t2 },
      { id: "web-04", type: "website", brandId: "brand-aetherpay", url: "https://login.aetherpay.help.example", host: "login.aetherpay.help.example", title: "Login", notes: "Misleading subdomain pattern", logoHint: "unknown", isOfficialSample: false, notedAt: t3 },
      { id: "web-05", type: "website", brandId: "brand-aetherpay", url: "https://support-aetherpay.example", host: "support-aetherpay.example", title: "Support", notes: "Support prefix", logoHint: "unknown", isOfficialSample: false, notedAt: t3 },
      { id: "web-06", type: "website", brandId: "brand-lumenmart", url: "https://lumenmart-offers.example/claim", host: "lumenmart-offers.example", title: "Claim rewards", notes: "Offers suffix", logoHint: "unknown", isOfficialSample: false, notedAt: t2 },
      { id: "web-07", type: "website", brandId: "brand-lumenmart", url: "https://lumen-mart.example", host: "lumen-mart.example", title: "Lumen Mart", notes: "Hyphenated lookalike", logoHint: "unknown", isOfficialSample: false, notedAt: t2 },
      { id: "web-08", type: "website", brandId: "brand-novahealth", url: "https://novahealth-refund.example", host: "novahealth-refund.example", title: "Refund portal", notes: "Refund bait", logoHint: "unknown", isOfficialSample: false, notedAt: t3 },
      { id: "web-09", type: "website", brandId: "brand-novahealth", url: "https://novahea1th.example/login", host: "novahea1th.example", title: "Patient login", notes: "Digit substitution", logoHint: "unknown", isOfficialSample: false, notedAt: t2 },
      { id: "web-10", type: "website", brandId: "brand-lumenmart", url: "https://lumenmart.example", host: "lumenmart.example", title: "LumenMart", notes: "Official demo domain", logoHint: "matches-official", isOfficialSample: true, notedAt: t1 }
    ];

    const allowlist = ["soc-08"];

    const cases = [
      { id: "CASE-2026-001", detectionId: "soc-02", brandId: "brand-aetherpay", campaignId: "camp-ap-support", status: "investigating", title: "AetherPay support impersonation on X", openedAt: t2, updatedAt: t3, notes: [{ at: t2, text: "Demo analyst: handle mimics official support and links off-domain." }, { at: t3, text: "Related lookalike domain opened as CASE-2026-002." }], actions: ["Preserve screenshots (simulated)", "Do not click the sample login link in a real browser session if this were production"], impact: { potentialAudience: 8400, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-002", detectionId: "web-02", brandId: "brand-aetherpay", campaignId: "camp-ap-support", status: "open", title: "Lookalike aetherpay-secure.example", openedAt: t2, updatedAt: t2, notes: [{ at: t2, text: "Hyphenated domain using security language. Simulated finding." }], actions: ["Compare DNS only if authorized in a real deployment", "Record registrar data when a real source exists"], impact: { potentialAudience: null, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-003", detectionId: "app-03", brandId: "brand-aetherpay", campaignId: "camp-ap-wallet", status: "open", title: "Copycat wallet listing", openedAt: t2, updatedAt: t2, notes: [{ at: t2, text: "Publisher string is close but not the official demo publisher." }], actions: ["Review store listing metadata", "Treat publisher mismatch as a signal, not proof"], impact: { potentialAudience: 2100, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-004", detectionId: "soc-07", brandId: "brand-lumenmart", campaignId: "camp-lm-offers", status: "investigating", title: "LumenMart offers scam-style profile", openedAt: t2, updatedAt: t3, notes: [{ at: t3, text: "Bio uses claim/rewards language. Demo only." }], actions: ["Map related offer domain"], impact: { potentialAudience: 5600, reportedVictims: 3, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-005", detectionId: "web-06", brandId: "brand-lumenmart", campaignId: "camp-lm-offers", status: "open", title: "lumenmart-offers.example", openedAt: t2, updatedAt: t2, notes: [{ at: t2, text: "Linked from the offers profile sample." }], actions: ["Keep impact fields unknown until evidence exists"], impact: { potentialAudience: null, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-006", detectionId: "soc-08", brandId: "brand-lumenmart", campaignId: null, status: "false-positive", title: "Lumen Marketplace — similar name, different brand", openedAt: t1, updatedAt: t2, notes: [{ at: t2, text: "Demo false positive. Independent fictional marketplace. Added to allowlist." }], actions: ["Keep on allowlist", "Do not treat name similarity as fraud"], impact: { potentialAudience: 1200, reportedVictims: 0, confirmedVictims: 0, reportedFinancialLoss: 0, confirmedFinancialLoss: 0 } },
      { id: "CASE-2026-007", detectionId: "soc-12", brandId: "brand-novahealth", campaignId: null, status: "dismissed", title: "Wellness blog with overlapping words", openedAt: t1, updatedAt: t2, notes: [{ at: t1, text: "Description disclaims affiliation. Weak evidence." }], actions: ["No action beyond monitoring"], impact: { potentialAudience: null, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-008", detectionId: "soc-11", brandId: "brand-novahealth", campaignId: "camp-nh-refund", status: "investigating", title: "Refund impersonation profile", openedAt: t3, updatedAt: t3, notes: [{ at: t3, text: "Refund + verify identity language." }], actions: ["Link refund domain case"], impact: { potentialAudience: 3100, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-009", detectionId: "web-08", brandId: "brand-novahealth", campaignId: "camp-nh-refund", status: "open", title: "novahealth-refund.example", openedAt: t3, updatedAt: t3, notes: [{ at: t3, text: "Lookalike refund portal. Simulated." }], actions: ["Document URL and official asset it resembles"], impact: { potentialAudience: null, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-010", detectionId: "app-10", brandId: "brand-novahealth", campaignId: null, status: "review-needed", title: "Nova Health Care+ publisher mismatch", openedAt: t3, updatedAt: t3, notes: [{ at: t3, text: "Needs human review. Similar name, different publisher." }], actions: ["Confirm whether listing is unrelated healthcare software"], impact: { potentialAudience: null, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-011", detectionId: "soc-14", brandId: "brand-aetherpay", campaignId: "camp-ap-support", status: "resolved", title: "TikTok giveaway profile (demo resolved)", openedAt: t3, updatedAt: t3, notes: [{ at: t3, text: "Demo resolution: labeled suspicious, no live takedown was performed." }], actions: ["Record as simulated close"], impact: { potentialAudience: 15000, reportedVictims: 1, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } },
      { id: "CASE-2026-012", detectionId: "web-04", brandId: "brand-aetherpay", campaignId: "camp-ap-support", status: "open", title: "Misleading subdomain login.aetherpay.help.example", openedAt: t3, updatedAt: t3, notes: [{ at: t3, text: "Brand token appears as a subdomain label, not the registrable demo domain." }], actions: ["Show registrable host vs official host"], impact: { potentialAudience: null, reportedVictims: null, confirmedVictims: null, reportedFinancialLoss: null, confirmedFinancialLoss: null } }
    ];

    return {
      version: 1,
      demoMode: true,
      createdAt: t0,
      lastScanAt: t3,
      scoringRules: Object.assign({}, BS.defaultRules),
      sources: BS.defaultSources(t3),
      brands: brands,
      officialSocial: officialSocial,
      officialApps: officialApps,
      observed: observed,
      allowlist: allowlist,
      cases: cases,
      scanHistory: [
        { at: "2026-10-03T10:00:00.000Z", high: 2, medium: 3, low: 8, review: 2, note: "Simulated scan of sample set" },
        { at: "2026-10-05T10:00:00.000Z", high: 3, medium: 4, low: 8, review: 2, note: "Simulated scan of sample set" },
        { at: "2026-10-07T10:00:00.000Z", high: 4, medium: 5, low: 9, review: 3, note: "Simulated scan of sample set" },
        { at: t3, high: 5, medium: 6, low: 10, review: 3, note: "Simulated scan of sample set" }
      ]
    };
  };

  root.BS = BS;
  if (typeof module !== "undefined") module.exports = BS;
})(typeof window !== "undefined" ? window : globalThis);
