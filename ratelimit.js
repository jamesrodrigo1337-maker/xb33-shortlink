"use strict";

/**
 * Token-bucket rate limiter per-IP + sliding-window limiter khusus create.
 * Semua in-process, murah (amortized O(1)), gak makan memori karena
 * entry idle di-GC berkala.
 */
class RateLimiter {
  constructor({ ratePerSec, burst, createPerMin }) {
    this.rate = ratePerSec;
    this.burst = burst;
    this.createPerMin = createPerMin;
    this.buckets = new Map(); // ip -> { tokens, last }
    this.createWindow = new Map(); // ip -> [timestamps]
    this._lastGc = Date.now();
  }

  _gc(now) {
    // GC tiap 60s: buang bucket yang gak aktif.
    if (now - this._lastGc < 60000) return;
    this._lastGc = now;
    for (const [ip, b] of this.buckets) {
      if (now - b.last > 120000) this.buckets.delete(ip);
    }
    for (const [ip, arr] of this.createWindow) {
      const filtered = arr.filter((t) => now - t < 60000);
      if (filtered.length === 0) this.createWindow.delete(ip);
      else this.createWindow.set(ip, filtered);
    }
  }

  allow(ip) {
    const now = Date.now();
    this._gc(now);
    let b = this.buckets.get(ip);
    if (!b) {
      b = { tokens: this.burst, last: now };
      this.buckets.set(ip, b);
    }
    // refill
    const elapsed = (now - b.last) / 1000;
    b.tokens = Math.min(this.burst, b.tokens + elapsed * this.rate);
    b.last = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return true;
    }
    return false;
  }

  allowCreate(ip) {
    const now = Date.now();
    let arr = this.createWindow.get(ip) || [];
    arr = arr.filter((t) => now - t < 60000);
    if (arr.length >= this.createPerMin) {
      this.createWindow.set(ip, arr);
      return false;
    }
    arr.push(now);
    this.createWindow.set(ip, arr);
    return true;
  }
}

module.exports = { RateLimiter };
