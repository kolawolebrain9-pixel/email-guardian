import express from 'express';
import { fetchRecentEmails } from '../services/gmailService.js';
import { deleteUserTokens } from '../services/googleAuth.js';
import { analyzeThreat } from '../services/threatEngine.js';
import { generateFriendlyExplanation } from '../services/explanationService.js';
import { recordAndGetCommunityCount, generateFingerprint, getCommunityThreatStatus, getCommunityConsensus } from '../services/communityService.js';
import { runQuery, getRow, getAllRows } from '../db/database.js';

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
      // Check if user already took action on this email or if we already have an explanation cached
      let actionTaken = null;
      let cachedExplanation = null;
      try {
        const existingScan = await getRow(
          `SELECT action_taken, risk_level, risk_score, explanation FROM scans WHERE user_email = ? AND message_id = ?`,
          [user.toLowerCase(), email.messageId]
        );
        if (existingScan) {
          actionTaken = existingScan.action_taken || null;
          cachedExplanation = existingScan.explanation || null;
        }
      } catch (e) {
        // Ignore DB lookup error
      }

      const threat = await analyzeThreat(email);

      // Check genuine community consensus from actual user actions
      const consensus = await getCommunityConsensus(threat.senderDomain, email.subject, user);

      // 1. If current user explicitly marked this email as safe, honor their decision
      if (actionTaken === 'safe') {
        threat.riskLevel = 'safe';
        threat.riskScore = 0;
      } else if (actionTaken === 'flag') {
        threat.riskLevel = 'risk';
        threat.riskScore = Math.max(threat.riskScore, 85);
      } else if (consensus.status === 'vouched') {
        // Community consensus: other members explicitly vouched this email as safe
        const memberWord = consensus.vouchedCount === 1 ? 'member' : 'members';
        threat.reasons.unshift(`Vouched as safe by ${consensus.vouchedCount} Vouch community ${memberWord}`);
        if (threat.riskLevel === 'caution') {
          threat.riskLevel = 'safe';
          threat.riskScore = 0;
        }
      } else if (consensus.status === 'flagged') {
        // Community consensus: other members flagged this email pattern as a scam
        threat.riskLevel = 'risk';
        threat.riskScore = Math.max(threat.riskScore, 85);
        const reportWord = consensus.flaggedCount === 1 ? 'member' : 'members';
        threat.reasons.unshift(`Reported as a scam by ${consensus.flaggedCount} Vouch community ${reportWord}`);
      }

      // Reuse cached explanation if available to prevent redundant OpenAI latency and costs
      const explanation = cachedExplanation || await generateFriendlyExplanation(email, threat.reasons, threat.riskLevel);
      const communityCount = await recordAndGetCommunityCount(
        threat.senderDomain,
        email.subject,
        threat.riskLevel,
        user,
        email.messageId
      );
      const fingerprint = generateFingerprint(threat.senderDomain, email.subject);

      // Save scan to database
      try {
        await runQuery(
          `INSERT INTO scans (
             user_email, message_id, thread_id, sender_name, sender_address,
             subject, date, snippet, risk_level, risk_score, reasons,
             explanation, community_count, fingerprint, action_taken, scanned_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            actionTaken,
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
        communityStatus: consensus.status,
        communityVouchedCount: consensus.vouchedCount,
        communityFlaggedCount: consensus.flaggedCount,
        actionTaken: actionTaken
      });
    }

    res.json({
      emails: scannedEmails.length > 0 ? scannedEmails : DEMO_EMAILS,
      isDemo: scannedEmails.length === 0,
      user
    });
  } catch (err) {
    console.error('Failed to fetch/scan emails:', err.message);
    const isPermissionError = Boolean(err.message && err.message.includes('Insufficient Permission'));
    const isAuthExpired = Boolean(
      err.message && (err.message.includes('invalid_grant') || err.message.includes('No credentials found'))
    );

    if ((isAuthExpired || isPermissionError) && user) {
      try {
        await deleteUserTokens(user);
        console.log(`Cleaned up OAuth tokens for user ${user} (reason: ${err.message})`);
      } catch (cleanErr) {
        console.error('Error clearing token:', cleanErr.message);
      }
    }

    let warningMsg = `Unable to access Gmail: ${err.message}. Showing sample inbox.`;
    if (isAuthExpired) {
      warningMsg = 'Your Google OAuth session has expired. Please click "Connect Gmail" to re-authenticate.';
    } else if (isPermissionError) {
      warningMsg = 'Gmail permission was not granted. Make sure to check the "View your email messages" box on the Google consent screen, and verify the Gmail API is enabled in Google Cloud Console.';
    }

    // Fallback to demo mode with warning header so UI stays functional
    res.json({
      emails: DEMO_EMAILS,
      isDemo: true,
      authExpired: isAuthExpired || isPermissionError,
      warning: warningMsg
    });
  }
});

// POST /api/emails/:id/action — Vouch as safe or Flag as scam
router.post('/:id/action', async (req, res) => {
  const { id } = req.params;
  const { action, userEmail } = req.body;

  const isSafeAction = action === 'safe' || action === 'vouch';
  const normalizedAction = isSafeAction ? 'safe' : 'flag';
  const updatedRiskLevel = isSafeAction ? 'safe' : 'risk';

  if (userEmail) {
    await runQuery(
      `UPDATE scans SET action_taken = ?, risk_level = ? WHERE message_id = ? AND user_email = ?`,
      [normalizedAction, updatedRiskLevel, id, userEmail.toLowerCase()]
    );

    // If flagged as scam, also contribute to crowdsourced community threat detection
    if (!isSafeAction) {
      try {
        const scan = await getRow(
          `SELECT fingerprint FROM scans WHERE message_id = ? AND user_email = ?`,
          [id, userEmail.toLowerCase()]
        );
        if (scan?.fingerprint) {
          const now = new Date().toISOString();
          await runQuery(
            `UPDATE community_fingerprints SET report_count = report_count + 1, last_seen = ? WHERE fingerprint = ?`,
            [now, scan.fingerprint]
          );
        }
      } catch (e) {
        // Ignore community increment error
      }
    }
  }

  res.json({
    success: true,
    id,
    action: normalizedAction,
    message: isSafeAction ? 'Vouched as safe.' : 'Flagged as scam — thank you for protecting the community.'
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

