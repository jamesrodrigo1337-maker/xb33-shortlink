"use strict";
const fs = require("fs");
const path = require("path");

/**
 * Persistent store dengan LRU cache.
 * - Hot path (redirect) dilayani dari Map in-memory -> gak nyentuh disk.
 * - Data di-flush ke JSON file secara periodik + atomic rename.
 */
class Store {
  constructor(file) {
    this.file = file;
    this.map = new Map(); // slug -> { url, hits, created }
    this.lru = new Map(); // slug -> url (snapshot utk redirect cepat)
    this.lruMax = 50000;
    this.dirty = false;
    this.load();
    this._timer = setInterval(() => this.flush(), 30000);
    this._timer.unref();
  }

  load() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file, "utf8");
        const data = JSON.parse(raw || "{}");
        for (const [k, v] of Object.entries(data)) this.map.set(k, v);
      }
      console.log(`[store] loaded ${this.map.size} links`);
    } catch (e) {
      console.error("[store] load failed:", e.message);
    }
  }

  get(slug) {
    return this.map.get(slug);
  }

  getWithCache(slug) {
    const hit = this.lru.get(slug);
    if (hit !== undefined) {
      // refresh LRU order
      this.lru.delete(slug);
      this.lru.set(slug, hit);
      return this.map.get(slug);
    }
    const e = this.map.get(slug);
    if (e) {
      this.lru.set(slug, e.url);
      if (this.lru.size > this.lruMax) {
        const first = this.lru.keys().next().value;
        this.lru.delete(first);
      }
    }
    return e;
  }

  put(slug, url) {
    const e = { url, hits: 0, created: Date.now() };
    this.map.set(slug, e);
    this.lru.set(slug, url);
    this.dirty = true;
  }

  hit(slug) {
    const e = this.map.get(slug);
    if (e) {
      e.hits++;
      this.dirty = true;
    }
  }

  flush() {
    if (!this.dirty) return;
    try {
      const obj = Object.fromEntries(this.map);
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(obj));
      fs.renameSync(tmp, this.file); // atomic
      this.dirty = false;
    } catch (e) {
      console.error("[store] flush failed:", e.message);
    }
  }

  flushSync() {
    this.dirty = true;
    this.flush();
  }
}

module.exports = { Store };
