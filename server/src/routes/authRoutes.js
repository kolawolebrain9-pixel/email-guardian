import express from 'express';
import crypto from 'crypto';
import { getAuthUrl, handleOAuthCallback, deleteUserTokens } from '../services/googleAuth.js';
import { getRow } from '../db/database.js';
import { config } from '../config.js';

const router = express.Router();

// 1. Initiate Google OAuth Flow (Protected with CSRF State)
router.get('/google', (req, res) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    return res.status(400).json({
      error: 'Google OAuth Client ID & Secret are not configured.',
      configured: false
    });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = getAuthUrl(state);

  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });

  if (req.query.format === 'json') {
    return res.json({ url: authUrl });
  }
  res.redirect(authUrl);
});

// 2. OAuth Callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const cookieHeader = req.headers.cookie || '';
  const storedState = cookieHeader.split('; ').find(row => row.startsWith('oauth_state='))?.split('=')[1];

  if (error) {
    console.error('Google OAuth error:', error);
    return res.redirect(`${config.clientUrl}/?auth_error=${encodeURIComponent(error)}`);
  }

  // Verify OAuth state parameter if present to protect against CSRF
  if (storedState && state && storedState !== state) {
    console.warn('OAuth state mismatch detected.');
    return res.redirect(`${config.clientUrl}/?auth_error=state_mismatch`);
  }

  if (!code) {
    return res.redirect(`${config.clientUrl}/?auth_error=missing_code`);
  }

  try {
    const user = await handleOAuthCallback(code);
    res.clearCookie('oauth_state');
    res.redirect(`${config.clientUrl}/?connected=true&user=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || '')}`);
  } catch (err) {
    console.error('OAuth token exchange error:', err);
    res.redirect(`${config.clientUrl}/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

// 3. Check Auth Status
router.get('/status', async (req, res) => {
  const userEmail = req.query.user;
  const isConfigured = Boolean(config.google.clientId && config.google.clientSecret);

  if (!userEmail) {
    return res.json({
      connected: false,
      oauthConfigured: isConfigured,
      user: null
    });
  }

  const tokenRow = await getRow(
    `SELECT user_email, updated_at FROM tokens WHERE user_email = ?`,
    [userEmail.toLowerCase()]
  );

  const userRow = await getRow(
    `SELECT email, name, picture FROM users WHERE email = ?`,
    [userEmail.toLowerCase()]
  );

  res.json({
    connected: Boolean(tokenRow),
    oauthConfigured: isConfigured,
    user: userRow || (tokenRow ? { email: tokenRow.user_email } : null)
  });
});

// 4. Disconnect Account
router.post('/disconnect', async (req, res) => {
  const { userEmail } = req.body;
  if (userEmail) {
    await deleteUserTokens(userEmail);
  }
  res.json({ success: true, message: 'Disconnected successfully.' });
});

export default router;

