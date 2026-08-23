import express from 'express';
import { fetchRecentEmails } from '../services/gmailService.js';
import { analyzeThreat } from '../services/threatEngine.js';
import { generateFriendlyExplanation } from '../services/explanationService.js';
import { recordAndGetCommunityCount, generateFingerprint } from '../services/communityService.js';
import { runQuery, getAllRows } from '../db/database.js';

const router = express.Router();

// Reference Mock / Demo Emails for instant testing
const DEMO_EMAILS = [
  {
    id: 'demo-1',
    messageId: 'demo-msg-1',
    sender: 'Mom',
    senderName: 'Mom',
    senderAddress: 'mom.family@gmail.com',
    subject: 'Dinner Sunday?',
    time: '2:14 PM',
    riskLevel: 'safe',
    riskScore: 0,
    reasons: ['Sender domain is verified and content matches personal conversation'],
    explanation: null,
    communityCount: 0,
    actionTaken: null
  },
  {
    id: 'demo-2',
    messageId: 'demo-msg-2',
    sender: 'PayPal Security',
    senderName: 'PayPal Security',
    senderAddress: 'paypal-secure@mailer-alerts.net',
    subject: 'Unusual login attempt on your account',
    time: '1:02 PM',
    riskLevel: 'caution',
    riskScore: 45,
    reasons: [
      'Sender address is `paypal-secure@mailer-alerts.net`, not a real PayPal domain',
      'Link text says "paypal.com" but points to `paypal.verify-id-check.com`',
      'Creates time pressure — real security emails don\'t threaten account closure this fast'
    ],
    explanation: `This one is trying to rush you. It says your account will be locked <b>unless you act now</b> — that urgency is the tell, not the login attempt itself. The button underneath doesn't actually go to paypal.com.`,
    communityCount: 212,
    actionTaken: null
  },
  {
    id: 'demo-3',
    messageId: 'demo-msg-3',
    sender: '"Bank of America"',
    senderName: 'Bank of America',
    senderAddress: 'support@secure-bank-login.xyz',
    subject: 'URGENT: Verify your account within 24 hours',
    time: '11:30 AM',
    riskLevel: 'risk',
    riskScore: 85,
    reasons: [
      'Real banks never ask you to "verify" by clicking a link in an email',
      'The link redirects three times before landing on a copycat login page',
      'Your name isn\'t used anywhere — just "Dear Customer," which real banks avoid'
    ],
    explanation: `This is a classic fake-bank scam. It's built to make you panic-click before you think. Nothing here actually connects to your real bank.`,
    communityCount: 1190,
    actionTaken: null
  },
  {
    id: 'demo-4',
    messageId: 'demo-msg-4',
    sender: 'Amazon',
    senderName: 'Amazon',
    senderAddress: 'auto-confirm@amazon.com',
    subject: 'Your order has shipped',
    time: '9:15 AM',
    riskLevel: 'safe',
    riskScore: 0,
    reasons: ['Authenticated Amazon domain with valid digital signatures'],
    explanation: null,
    communityCount: 0,
    actionTaken: null
  }
];

// GET /api/emails — Fetch and scan recent emails
router.get('/', async (req, res) => {
  const { user, mode } = req.query;

  // Return demo dataset if in demo mode or if user is not provided
  if (mode === 'demo' || !user) {
    return res.json({
      emails: DEMO_EMAILS,
      isDemo: true,
      user: null
    });
  }

  try {
    // 1. Fetch raw messages from Gmail API
    const rawEmails = await fetchRecentEmails(user, 25);
    const now = new Date().toISOString();

    // 2. Scan each email through the threat engine
    const scannedEmails = [];

    for (const email of rawEmails) {
      const threat = await analyzeThreat(email);
      const explanation = await generateFriendlyExplanation(email, threat.reasons, threat.riskLevel);
      const communityCount = await recordAndGetCommunityCount(
        threat.senderDomain,
        email.subject,
        threat.riskLevel
      );
      const fingerprint = generateFingerprint(threat.senderDomain, email.subject);

      // Save scan to database
      try {
        await runQuery(
          `INSERT INTO scans (
             user_email, message_id, thread_id, sender_name, sender_address,
             subject, date, snippet, risk_level, risk_score, reasons,
             explanation, community_count, fingerprint, scanned_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_email, message_id) DO UPDATE SET
             risk_level = excluded.risk_level,
             risk_score = excluded.risk_score,
             reasons = excluded.reasons,
             explanation = excluded.explanation,
             community_count = excluded.community_count,
             scanned_at = excluded.scanned_at`,
          [
            user.toLowerCase(),
            email.messageId,
            email.threadId,
            email.senderName,
            email.senderAddress,
            email.subject,
            email.date,
            email.snippet,
            threat.riskLevel,
            threat.riskScore,
            JSON.stringify(threat.reasons),
            explanation,
            communityCount,
            fingerprint,
            now
          ]
        );
      } catch (dbErr) {
        console.error('Error caching scan in DB:', dbErr.message);
      }

      scannedEmails.push({
        id: email.messageId,
        messageId: email.messageId,
        sender: email.senderName || email.senderAddress,
        senderName: email.senderName,
        senderAddress: email.senderAddress,
        subject: email.subject,
        time: formatEmailTime(email.date),
        riskLevel: threat.riskLevel,
        riskScore: threat.riskScore,
        reasons: threat.reasons,
        explanation: explanation,
        communityCount: communityCount,
        actionTaken: null
      });
    }

    res.json({
      emails: scannedEmails.length > 0 ? scannedEmails : DEMO_EMAILS,
      isDemo: scannedEmails.length === 0,
      user
    });
  } catch (err) {
    console.error('Failed to fetch/scan emails:', err.message);
    // Fallback to demo mode with warning header so UI stays functional
    res.json({
      emails: DEMO_EMAILS,
      isDemo: true,
      warning: `Unable to access Gmail: ${err.message}. Showing sample inbox.`
    });
  }
});

// POST /api/emails/:id/action — Mark as safe or Block sender
router.post('/:id/action', async (req, res) => {
  const { id } = req.params;
  const { action, userEmail } = req.body;

  if (userEmail) {
    await runQuery(
      `UPDATE scans SET action_taken = ? WHERE message_id = ? AND user_email = ?`,
      [action, id, userEmail.toLowerCase()]
    );
  }

  res.json({
    success: true,
    id,
    action,
    message: action === 'block' ? 'Sender has been flagged and blocked.' : 'Marked as safe.'
  });
});

function formatEmailTime(dateStr) {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Today';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'Today';
  }
}

export default router;

