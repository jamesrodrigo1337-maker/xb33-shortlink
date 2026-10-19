"use strict";
const fs = require("fs");
const path = require("path");

/**
 * Analytics engine — naruh ringkasan traffic in-memory, flush periodik.
 * Struktur ringkas biar hemat memori walau traffic rame:
 *   - totalHits per slug
 *   - timeseries per-menit (dibucket) untuk chart
 *   - referrer & UA breakdown (top-N, di-cap)
 *   - rolling log hit terakhir (untuk table live)
 */
class Analytics {
  constructor(file) {
    this.file = file;
    this.minutes = new Map(); // "slug|YYYYMMDDHHMM" -> count
    this.refs = new Map(); // slug -> { ref: count }
    this.uas = new Map(); // slug -> { uaFamily: count }
    this.countries = new Map(); // slug -> { cc: count }
    this.recent = []; // rolling log ~2000 entri terakhir
    this.recentMax = 2000;
    this._dirty = false;
    this._minuteKeys = [];
    this.load();
    this._timer = setInterval(() => this.flush(), 20000);
    this._timer.unref();
  }

  load() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      if (fs.existsSync(this.file)) {
        const d = JSON.parse(fs.readFileSync(this.file, "utf8") || "{}");
        this.minutes = new Map(d.minutes || []);
        this.refs = new Map((d.refs || []).map(([k, v]) => [k, new Map(Object.entries(v))]));
        this.uas = new Map((d.uas || []).map(([k, v]) => [k, new Map(Object.entries(v))]));
        this.countries = new Map((d.countries || []).map(([k, v]) => [k, new Map(Object.entries(v))]));
        this.recent = d.recent || [];
        console.log(`[analytics] loaded ${this.minutes.size} minute-buckets`);
      }
    } catch (e) {
      console.error("[analytics] load failed:", e.message);
    }
  }

  _bump(map, slug, key) {
    let m = map.get(slug);
    if (!m) { m = new Map(); map.set(slug, m); }
    m.set(key, (m.get(key) || 0) + 1);
  }

  record(slug, { ref, ua, cc }) {
    const now = new Date();
    const mk =
      slug + "|" +
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0");

    this.minutes.set(mk, (this.minutes.get(mk) || 0) + 1);
    this._minuteKeys.push(mk);

    if (ref) this._bump(this.refs, slug, ref);
    if (ua) this._bump(this.uas, slug, uaFamily(ua));
    if (cc) this._bump(this.countries, slug, cc);

    this.recent.push({ slug, t: now.getTime(), ref: ref || "-", ua: ua ? uaFamily(ua) : "-", cc: cc || "-" });
    if (this.recent.length > this.recentMax) this.recent.splice(0, this.recent.length - this.recentMax);

    this._dirty = true;
    // Batasi jumlah minute-keys di memori (7 hari cukup).
    if (this._minuteKeys.length > 20000) {
      const drop = this._minuteKeys.splice(0, 5000);
      for (const k of drop) this.minutes.delete(k);
    }
  }

  /** Timeseries total lintas semua link, N menit terakhir. */
  totalSeries(nMinutes) {
    const out = [];
    const now = new Date();
    for (let i = nMinutes - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60000);
      const prefix = "" + d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0") +
        String(d.getHours()).padStart(2, "0") +
        String(d.getMinutes()).padStart(2, "0");
      let sum = 0;
      for (const [k, v] of this.minutes) if (k.endsWith("|" + prefix)) sum += v;
      out.push({ t: d.getTime(), label: hhmm(d), v: sum });
    }
    return out;
  }

  seriesFor(slug, nMinutes) {
    const out = [];
    const now = new Date();
    for (let i = nMinutes - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60000);
      const key = slug + "|" + d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0") +
        String(d.getHours()).padStart(2, "0") +
        String(d.getMinutes()).padStart(2, "0");
      out.push({ t: d.getTime(), label: hhmm(d), v: this.minutes.get(key) || 0 });
    }
    return out;
  }

  top(mapName, slug, n) {
    const map = this[mapName].get(slug);
    if (!map) return [];
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v }));
  }

  totalRecent(n) {
    return this.recent.slice(-n).reverse();
  }

  flush() {
    if (!this._dirty) return;
    try {
      const obj = {
        minutes: [...this.minutes],
        refs: [...this.refs].map(([k, m]) => [k, Object.fromEntries(m)]),
        uas: [...this.uas].map(([k, m]) => [k, Object.fromEntries(m)]),
        countries: [...this.countries].map(([k, m]) => [k, Object.fromEntries(m)]),
        recent: this.recent,
      };
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(obj));
      fs.renameSync(tmp, this.file);
      this._dirty = false;
    } catch (e) {
      console.error("[analytics] flush failed:", e.message);
    }
  }
}

function hhmm(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/** Ringkas User-Agent jadi keluarga browser/bot — hemat memori. */
function uaFamily(ua) {
  const s = String(ua);
  if (/bot|crawl|spider|slurp|headless|python|curl|wget|httpie|go-http/i.test(s)) return "Bot/Crawler";
  if (/edg\//i.test(s)) return "Edge";
  if (/firefox/i.test(s)) return "Firefox";
  if (/chrome|crios/i.test(s)) return "Chrome";
  if (/safari/i.test(s)) return "Safari";
  if (/opera|opr\//i.test(s)) return "Opera";
  return "Lainnya";
}

module.exports = { Analytics, uaFamily };
