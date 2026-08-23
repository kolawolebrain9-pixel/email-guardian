import express from 'express';
import { getAuthUrl, handleOAuthCallback, deleteUserTokens } from '../services/googleAuth.js';
import { getRow } from '../db/database.js';
import { config } from '../config.js';

const router = express.Router();

// 1. Initiate Google OAuth Flow
router.get('/google', (req, res) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    return res.status(400).json({
      error: 'Google OAuth Client ID & Secret are not configured.',
      configured: false
    });
  }

  const authUrl = getAuthUrl();
  // If request wants JSON URL, return JSON; otherwise redirect
  if (req.query.format === 'json') {
    return res.json({ url: authUrl });
  }
  res.redirect(authUrl);
});

// 2. OAuth Callback
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Google OAuth error:', error);
    return res.redirect(`${config.clientUrl}/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${config.clientUrl}/?auth_error=missing_code`);
  }

  try {
    const user = await handleOAuthCallback(code);
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

