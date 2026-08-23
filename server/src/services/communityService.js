import crypto from 'crypto';
import { runQuery, getRow } from '../db/database.js';

/**
 * Generate a privacy-preserving fingerprint for an email pattern:
 * SHA-256(sender_domain + ":" + normalized_subject)
 */
export function generateFingerprint(senderDomain, subject) {
  const normDomain = (senderDomain || '').toLowerCase().trim();
  const normSubject = normalizeSubject(subject || '');
  return crypto.createHash('sha256').update(`${normDomain}:${normSubject}`).digest('hex').slice(0, 24);
}

export function normalizeSubject(subject) {
  let cleaned = (subject || '').toLowerCase();
  // Iteratively strip leading email prefixes (Re:, Fwd:, Fw:, Urgent:, Action Required:)
  cleaned = cleaned.replace(/^(?:(?:re|fwd|fw|urgent|action required)\s*:\s*)+/gi, '');
  return cleaned
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Record a flagged email in the community database and return the total count of people who received it
 */
export async function recordAndGetCommunityCount(senderDomain, subject, riskLevel) {
  if (riskLevel === 'safe') return 0;

  const fingerprint = generateFingerprint(senderDomain, subject);
  const now = new Date().toISOString();
  const normSub = normalizeSubject(subject);

  const existing = await getRow(
    `SELECT * FROM community_fingerprints WHERE fingerprint = ?`,
    [fingerprint]
  );

  let count = 1;

    if (existing) {
    count = existing.report_count + 1;
    await runQuery(
      `UPDATE community_fingerprints SET report_count = ?, last_seen = ? WHERE fingerprint = ?`,
      [count, now, fingerprint]
    );
  } else {
    // Real first-time report — start honestly at 1, no fake seeding
    count = 1;
    await runQuery(
      `INSERT INTO community_fingerprints (fingerprint, sender_domain, normalized_subject, report_count, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fingerprint, senderDomain, normSub, count, now, now]
    );
  }

  // Increment daily global vouched counter
  const today = new Date().toISOString().slice(0, 10);
  await runQuery(
    `UPDATE stats SET vouched_count = vouched_count + 1 WHERE date = ?`,
    [today]
  );

  return count;
}

export async function getGlobalVouchedCount() {
  const today = new Date().toISOString().slice(0, 10);
  const stat = await getRow(`SELECT vouched_count FROM stats WHERE date = ?`, [today]);
  return stat ? stat.vouched_count : 0;
}
