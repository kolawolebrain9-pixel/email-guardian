import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken } from '../src/services/googleAuth.js';
import { analyzeThreat } from '../src/services/threatEngine.js';
import { generateFingerprint, normalizeSubject } from '../src/services/communityService.js';
import { initDb } from '../src/db/database.js';

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
});

