"use strict";
const crypto = require("crypto");

/**
 * Proof-of-Work challenge (Hashcash-style, hex leading zeros).
 * Server kasih challenge -> client brute nonce sampe sha256(challenge+nonce)
 * punya N leading zero hex -> kirim balik. Ini maksa bot ngeluarin CPU,
 * sementara manusia asli gak kerasa (difficulty rendah).
 */
class PowChallenge {
  constructor({ difficulty, ttlMs }) {
    this.difficulty = difficulty;
    this.ttlMs = ttlMs;
    this.seen = new Set(); // cegah replay
  }

  issue() {
    const challenge = crypto.randomBytes(16).toString("hex");
    const ts = Date.now();
    return { challenge, difficulty: this.difficulty, ts };
  }

  verify(nonce, challenge, ts) {
    if (typeof nonce !== "string" || typeof challenge !== "string") return false;
    if (typeof ts !== "number") return false;
    if (Date.now() - ts > this.ttlMs) return false; // expired
    if (this.seen.has(challenge)) return false; // replay
    this.seen.add(challenge);
    // GC seen set biar gak bocor memori.
    if (this.seen.size > 100000) {
      const it = this.seen.values();
      for (let i = 0; i < 50000; i++) this.seen.delete(it.next().value);
    }

    const hash = crypto
      .createHash("sha256")
      .update(challenge + nonce)
      .digest("hex");
    const prefix = "0".repeat(this.difficulty);
    return hash.startsWith(prefix);
  }
}

module.exports = { PowChallenge };
