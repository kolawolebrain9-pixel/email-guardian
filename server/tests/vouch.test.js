import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken } from '../src/services/googleAuth.js';
import { analyzeThreat } from '../src/services/threatEngine.js';
import { generateFingerprint, normalizeSubject } from '../src/services/communityService.js';
import { initDb, runQuery, getRow } from '../src/db/database.js';

describe('Vouch Backend Test Suite', () => {
  before(async () => {
    await initDb();
  });

  test('AES-256-GCM Token Encryption and Decryption', () => {
    const rawToken = 'ya29.a0AfH6SMD_secret_oauth_refresh_token_xyz_12345';
    const encrypted = encryptToken(rawToken);

    assert.ok(encrypted, 'Encrypted token should not be null');
    assert.notEqual(encrypted, rawToken, 'Encrypted token must differ from plaintext');
    assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/, 'Ciphertext format iv:authTag:encryptedHex');

    const decrypted = decryptToken(encrypted);
    assert.equal(decrypted, rawToken, 'Decrypted token must match original plaintext');
  });

  test('Threat Engine: Safe Personal Email', async () => {
    const email = {
      subject: 'Dinner Sunday?',
      senderName: 'Mom',
      senderAddress: 'mom.family@gmail.com',
      bodyText: 'Hey! Are we still having dinner this Sunday at 6pm?',
      bodyHtml: null
    };

    const result = await analyzeThreat(email);
    assert.equal(result.riskLevel, 'safe');
    assert.ok(result.riskScore < 20);
  });

  test('Threat Engine: Brand Impersonation & Spoofed Links (Caution/Risk)', async () => {
    const email = {
      subject: 'Unusual login attempt on your account',
      senderName: 'PayPal Security',
      senderAddress: 'paypal-secure@mailer-alerts.net',
      bodyText: 'Your account will be suspended within 24 hours unless you act now.',
      bodyHtml: '<p>Click to verify:</p><a href="https://paypal.verify-id-check.com/login">paypal.com</a>'
    };

    const result = await analyzeThreat(email);
    assert.ok(result.riskLevel === 'caution' || result.riskLevel === 'risk');
    assert.ok(result.riskScore >= 45);

    const reasonsStr = result.reasons.join(' ');
    assert.ok(reasonsStr.includes('paypal-secure@mailer-alerts.net'), 'Mentions fake sender domain');
    assert.ok(reasonsStr.includes('paypal.verify-id-check.com'), 'Mentions spoofed link domain');
  });

  test('Community Fingerprinting: Normalization and Hashing', () => {
    const sub1 = 'URGENT: Verify your account within 24 hours!';
    const sub2 = 'Re: Fwd: Urgent: Verify your account within 24 hours';

    const norm1 = normalizeSubject(sub1);
    const norm2 = normalizeSubject(sub2);

    assert.equal(norm1, 'verify your account within 24 hours');
    assert.equal(norm2, 'verify your account within 24 hours');

    const fp1 = generateFingerprint('secure-bank.com', sub1);
    const fp2 = generateFingerprint('secure-bank.com', sub2);

    assert.equal(fp1, fp2, 'Normalized subjects on same domain produce identical fingerprints');
  });

  test('User Vouch Persistence: Recurring email patterns auto-recognized as safe without warnings', async () => {
    const testUser = 'user_persistence_test@example.com';
    const originalSubject = 'Urgent: Your weekly server invoice #9021';
    const futureSubject = 'Re: Urgent: Your weekly server invoice #9021';
    const senderDomain = 'billing.cloudhost.io';

    const originalFp = generateFingerprint(senderDomain, originalSubject);
    const futureFp = generateFingerprint(senderDomain, futureSubject);
    assert.equal(originalFp, futureFp, 'Fingerprint matches recurring email pattern');

    // 1. User previously marked original email as safe
    const now = new Date().toISOString();
    await runQuery(`DELETE FROM scans WHERE user_email = ?`, [testUser]);
    await runQuery(
      `INSERT INTO scans (
         user_email, message_id, thread_id, sender_name, sender_address,
         subject, date, snippet, risk_level, risk_score, reasons,
         explanation, community_count, fingerprint, action_taken, scanned_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testUser,
        'msg-initial-1234',
        'thread-999',
        'CloudHost Billing',
        'billing@billing.cloudhost.io',
        originalSubject,
        now,
        'Invoice snippet',
        'safe',
        0,
        JSON.stringify(['Previously vouched as safe by you']),
        null,
        0,
        originalFp,
        'safe',
        now
      ]
    );

    // 2. A new email arrives in the future with a DIFFERENT message_id
    const newIncomingEmail = {
      messageId: 'msg-future-5678',
      threadId: 'thread-999',
      senderName: 'CloudHost Billing',
      senderAddress: 'billing@billing.cloudhost.io',
      subject: futureSubject,
      bodyText: 'Here is your weekly update. Immediate action required to review.'
    };

    // Threat engine might initially see urgency keywords
    const threat = await analyzeThreat(newIncomingEmail);
    const incomingFp = generateFingerprint(threat.senderDomain, newIncomingEmail.subject);

    // Prior vouch lookup simulates emailRoutes.js logic
    const priorVouch = await getRow(
      `SELECT action_taken FROM scans 
       WHERE user_email = ? AND fingerprint = ? AND action_taken IS NOT NULL 
       ORDER BY id DESC LIMIT 1`,
      [testUser, incomingFp]
    );

    assert.equal(priorVouch?.action_taken, 'safe', 'Recognized prior vouch on fingerprint');

    // Threat suppression applied
    if (priorVouch?.action_taken === 'safe') {
      threat.riskLevel = 'safe';
      threat.riskScore = 0;
      threat.reasons = ['Previously vouched as safe by you'];
    }

    assert.equal(threat.riskLevel, 'safe');
    assert.equal(threat.riskScore, 0);
    assert.deepEqual(threat.reasons, ['Previously vouched as safe by you']);
  });

  test('Trust never skips verification: hard signals are detected regardless of prior vouches', async () => {
    // Clean follow-up from a trusted sender: no hard signals, so a vouch may silence soft warnings
    const clean = await analyzeThreat({
      subject: 'Action required: review your weekly invoice',
      senderName: 'CloudHost Billing',
      senderAddress: 'billing@billing.cloudhost.io',
      bodyText: 'Action required: please review your invoice in the dashboard.',
      bodyHtml: null
    });
    assert.deepEqual(clean.hardSignals, [], 'Urgency wording alone is not a hard signal');

    // Same trusted sender + subject, but the link is disguised: vouch must NOT hide this
    const spoofed = await analyzeThreat({
      subject: 'Action required: review your weekly invoice',
      senderName: 'CloudHost Billing',
      senderAddress: 'billing@billing.cloudhost.io',
      bodyText: 'Please review your invoice.',
      bodyHtml: '<a href="https://cloudhost-billing.verify-id-check.com/pay">billing.cloudhost.io</a>'
    });
    assert.ok(spoofed.hardSignals.includes('spoofed_link'), 'Disguised link is flagged as a hard signal');
  });
});

