import crypto from 'crypto';
import { google } from 'googleapis';
import { config } from '../config.js';
import { runQuery, getRow } from '../db/database.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Derive 32-byte key from configuration
function getDerivedKey() {
  return crypto.createHash('sha256').update(config.encryptionKey).digest();
}

export function encryptToken(plainText) {
  if (!plainText) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getDerivedKey(), iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptToken(cipherText) {
  if (!cipherText) return null;
  try {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getDerivedKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt token:', err.message);
    return null;
  }
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

export function getAuthUrl(state = '') {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.google.scopes,
    include_granted_scopes: true,
    ...(state ? { state } : {})
  });
}

export async function handleOAuthCallback(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch user profile info
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: profile } = await oauth2.userinfo.get();
  const userEmail = profile.email.toLowerCase();
  const now = new Date().toISOString();

  // Save or update user
  await runQuery(
    `INSERT INTO users (email, name, picture, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, picture = excluded.picture`,
    [userEmail, profile.name || profile.email, profile.picture || '', now]
  );

  // Encrypt and save tokens
  const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
  const encryptedAccess = encryptToken(tokens.access_token);

  if (encryptedRefresh) {
    await runQuery(
      `INSERT INTO tokens (user_email, encrypted_refresh_token, encrypted_access_token, expiry_date, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_email) DO UPDATE SET
         encrypted_refresh_token = excluded.encrypted_refresh_token,
         encrypted_access_token = excluded.encrypted_access_token,
         expiry_date = excluded.expiry_date,
         updated_at = excluded.updated_at`,
      [userEmail, encryptedRefresh, encryptedAccess, tokens.expiry_date || null, now]
    );
  } else {
    // Retain existing refresh token if Google didn't return a new one
    await runQuery(
      `UPDATE tokens SET
         encrypted_access_token = ?,
         expiry_date = ?,
         updated_at = ?
       WHERE user_email = ?`,
      [encryptedAccess, tokens.expiry_date || null, now, userEmail]
    );
  }

  return {
    email: userEmail,
    name: profile.name,
    picture: profile.picture
  };
}

export async function getAuthenticatedClient(userEmail) {
  const tokenRow = await getRow(
    `SELECT * FROM tokens WHERE user_email = ?`,
    [userEmail.toLowerCase()]
  );

  if (!tokenRow) {
    throw new Error(`No credentials found for user ${userEmail}`);
  }

  const refreshToken = decryptToken(tokenRow.encrypted_refresh_token);
  const accessToken = decryptToken(tokenRow.encrypted_access_token);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
    expiry_date: tokenRow.expiry_date
  });

  // Check if token expired and refresh if necessary
  oauth2Client.on('tokens', async (newTokens) => {
    const now = new Date().toISOString();
    const updatedAccess = encryptToken(newTokens.access_token);
    const updatedRefresh = newTokens.refresh_token ? encryptToken(newTokens.refresh_token) : null;

    if (updatedRefresh) {
      await runQuery(
        `UPDATE tokens SET encrypted_access_token = ?, encrypted_refresh_token = ?, expiry_date = ?, updated_at = ? WHERE user_email = ?`,
        [updatedAccess, updatedRefresh, newTokens.expiry_date || null, now, userEmail.toLowerCase()]
      );
    } else {
      await runQuery(
        `UPDATE tokens SET encrypted_access_token = ?, expiry_date = ?, updated_at = ? WHERE user_email = ?`,
        [updatedAccess, newTokens.expiry_date || null, now, userEmail.toLowerCase()]
      );
    }
  });

  return oauth2Client;
}

export async function deleteUserTokens(userEmail) {
  await runQuery(`DELETE FROM tokens WHERE user_email = ?`, [userEmail.toLowerCase()]);
}

