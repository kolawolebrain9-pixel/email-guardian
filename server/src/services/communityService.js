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
 * Record a flagged email in the community database and return the count of OTHER people who received it.
 *
 * Prevents false community counts by:
 * 1. Tracking scans per user & message_id to avoid counting page refreshes as new victims.
 * 2. Counting only distinct other users (excluding current user) who received this fingerprint.
 * 3. Returning 0 if no other distinct users have received the flagged email.
 */
export async function recordAndGetCommunityCount(senderDomain, subject, riskLevel, userEmail = '', messageId = '') {
  if (riskLevel === 'safe') return 0;

  const fingerprint = generateFingerprint(senderDomain, subject);
  const now = new Date().toISOString();
  const normSub = normalizeSubject(subject);
  const userLower = (userEmail || '').toLowerCase().trim();

  // Check if this specific email scan already exists for this user (prevent duplicate counts on refresh)
  let isNewScan = true;
  if (userLower && messageId) {
    const existingScan = await getRow(
      `SELECT id FROM scans WHERE user_email = ? AND message_id = ?`,
      [userLower, messageId]
    );
    if (existingScan) {
      isNewScan = false;
    }
  }

  // Count distinct OTHER users who received this flagged email
  let otherUsersCount = 0;
  if (userLower) {
    const otherUsersRow = await getRow(
      `SELECT COUNT(DISTINCT user_email) as count
       FROM scans
       WHERE fingerprint = ? AND user_email != ? AND risk_level IN ('caution', 'risk')`,
      [fingerprint, userLower]
    );
    otherUsersCount = otherUsersRow ? Number(otherUsersRow.count) : 0;
  }

  // Record in community_fingerprints table on fresh scans only
  if (isNewScan) {
    const existing = await getRow(
      `SELECT * FROM community_fingerprints WHERE fingerprint = ?`,
      [fingerprint]
    );

    if (existing) {
      await runQuery(
        `UPDATE community_fingerprints SET report_count = report_count + 1, last_seen = ? WHERE fingerprint = ?`,
        [now, fingerprint]
      );
    } else {
      await runQuery(
        `INSERT INTO community_fingerprints (fingerprint, sender_domain, normalized_subject, report_count, first_seen, last_seen)
         VALUES (?, ?, ?, 1, ?, ?)`,
        [fingerprint, senderDomain, normSub, now, now]
      );
    }

    // Increment daily global vouched counter
    const today = new Date().toISOString().slice(0, 10);
    await runQuery(
      `UPDATE stats SET vouched_count = vouched_count + 1 WHERE date = ?`,
      [today]
    );
  }

  return otherUsersCount;
}

/**
 * Check if an email pattern has been flagged by the community
 */
export async function getCommunityThreatStatus(senderDomain, subject) {
  const fingerprint = generateFingerprint(senderDomain, subject);
  try {
    const row = await getRow(
      `SELECT report_count FROM community_fingerprints WHERE fingerprint = ?`,
      [fingerprint]
    );
    if (row && Number(row.report_count) > 0) {
      return {
        isCommunityFlagged: true,
        reportCount: Number(row.report_count),
        fingerprint
      };
    }
  } catch {
    // Database lookup fallback
  }
  return {
    isCommunityFlagged: false,
    reportCount: 0,
    fingerprint
  };
}

export async function getGlobalVouchedCount() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    // Count distinct inboxes that were actually scanned and verified today
    const res = await getRow(
      `SELECT COUNT(DISTINCT user_email) as count FROM scans WHERE user_email NOT LIKE ? AND scanned_at >= ?`,
      ['%@example.com', today]
    );
    const count = res ? Number(res.count) : 0;
    return count > 0 ? count : 1;
  } catch {
    return 1;
  }
}
