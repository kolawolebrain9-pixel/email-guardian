import { google } from 'googleapis';
import { getAuthenticatedClient } from './googleAuth.js';

export async function fetchRecentEmails(userEmail, maxResults = 30) {
  const authClient = await getAuthenticatedClient(userEmail);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  // List recent messages from user's inbox
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: maxResults,
    q: 'in:inbox'
  });

  const messages = listRes.data.messages || [];
  const detailedEmails = [];

  // Fetch full details for each email in parallel batches
  const batchSize = 10;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });
          return parseGmailMessage(detail.data);
        } catch (err) {
          console.error(`Error fetching message ${msg.id}:`, err.message);
          return null;
        }
      })
    );
    detailedEmails.push(...results.filter(Boolean));
  }

  return detailedEmails;
}

function parseGmailMessage(msgData) {
  const headers = msgData.payload?.headers || [];
  const headerMap = {};
  for (const h of headers) {
    headerMap[h.name.toLowerCase()] = h.value;
  }

  const subject = headerMap['subject'] || '(No Subject)';
  const fromHeader = headerMap['from'] || '';
  const dateHeader = headerMap['date'] || '';
  const replyToHeader = headerMap['reply-to'] || '';

  const { name: senderName, email: senderAddress } = parseAddress(fromHeader);
  const { name: replyToName, email: replyToAddress } = parseAddress(replyToHeader);

  const { bodyText, bodyHtml } = extractBodies(msgData.payload);

  return {
    messageId: msgData.id,
    threadId: msgData.threadId,
    subject,
    senderName: senderName || senderAddress || 'Unknown Sender',
    senderAddress: senderAddress.toLowerCase(),
    replyToAddress: replyToAddress ? replyToAddress.toLowerCase() : null,
    date: dateHeader,
    snippet: msgData.snippet || '',
    bodyText,
    bodyHtml,
    headers: headerMap
  };
}

function parseAddress(headerStr) {
  if (!headerStr) return { name: '', email: '' };

  const match = headerStr.match(/^(?:"?([^"]*)"?\s)?(?:<(.+)>)?$/);
  if (match) {
    const name = (match[1] || '').trim();
    const email = (match[2] || '').trim();
    if (email) return { name, email };
  }

  // Fallback for bare email or unstructured format
  const emailMatch = headerStr.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    const email = emailMatch[1];
    const name = headerStr.replace(emailMatch[0], '').replace(/[<>"']/g, '').trim();
    return { name: name || email, email };
  }

  return { name: headerStr.trim(), email: headerStr.trim() };
}

function extractBodies(payload) {
  let bodyText = '';
  let bodyHtml = '';

  if (!payload) return { bodyText, bodyHtml };

  function traverse(part) {
    if (!part) return;

    const mimeType = part.mimeType || '';
    const data = part.body?.data;

    if (data) {
      const decoded = Buffer.from(data, 'base64url').toString('utf8');
      if (mimeType === 'text/plain') {
        bodyText += (bodyText ? '\n' : '') + decoded;
      } else if (mimeType === 'text/html') {
        bodyHtml += (bodyHtml ? '\n' : '') + decoded;
      }
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        traverse(subPart);
      }
    }
  }

  traverse(payload);
  return { bodyText, bodyHtml };
}

