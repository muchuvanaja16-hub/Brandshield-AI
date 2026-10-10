/* BrandShield AI — shared helpers (browser + Node). */
(function (root) {
  const BS = root.BS || {};

  BS.escapeHtml = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  BS.normalize = function (value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  BS.levenshtein = function (a, b) {
    a = String(a || "");
    b = String(b || "");
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = [];
    for (let i = 0; i <= b.length; i += 1) row[i] = i;
    for (let i = 1; i <= a.length; i += 1) {
      let prev = i;
      for (let j = 1; j <= b.length; j += 1) {
        const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
        row[j - 1] = prev;
        prev = val;
      }
      row[b.length] = prev;
    }
    return row[b.length];
  };

  BS.similarity = function (a, b) {
    const left = BS.normalize(a);
    const right = BS.normalize(b);
    if (!left || !right) return 0;
    if (left === right) return 100;
    const dist = BS.levenshtein(left, right);
    return Math.round((1 - dist / Math.max(left.length, right.length)) * 100);
  };

  BS.contains = function (hay, needle) {
    return String(hay || "").toLowerCase().indexOf(String(needle || "").toLowerCase()) !== -1;
  };

  BS.hostFrom = function (value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = raw.indexOf("://") === -1 ? "https://" + raw : raw;
      return new URL(url).hostname.toLowerCase().replace(/^\.+|\.+$/g, "");
    } catch (err) {
      return raw.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
    }
  };

  BS.registrable = function (host) {
    const parts = String(host || "").toLowerCase().split(".").filter(Boolean);
    const multi = { "co.uk": 1, "com.au": 1, "co.in": 1, "com.sg": 1, "co.nz": 1, "example.com": 0 };
    if (parts.length >= 3 && multi[parts.slice(-2).join(".")]) return parts.slice(-3).join(".");
    return parts.length >= 2 ? parts.slice(-2).join(".") : host;
  };

  BS.formatWhen = function (iso) {
    if (!iso) return "Unknown";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  };

  BS.unknown = function (value) {
    if (value === 0) return "0";
    if (value == null || value === "" || value === "unknown") return "Unknown";
    return String(value);
  };

  BS.downloadText = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  };

  BS.csvEscape = function (value) {
    const s = value == null ? "" : String(value);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  BS.uid = function (prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  };

  BS.deepClone = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  BS.toast = function (message, kind) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = message;
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  };

  BS.setLoading = function (on) {
    const el = document.getElementById("loading");
    if (!el) return;
    el.classList.toggle("hidden", !on);
  };

  root.BS = BS;
  if (typeof module !== "undefined") module.exports = BS;
})(typeof window !== "undefined" ? window : globalThis);
