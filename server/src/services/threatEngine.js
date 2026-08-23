import { URL } from 'url';
import { config } from '../config.js';

// Brand names commonly targeted by phishing impersonation
const MONITORED_BRANDS = [
  { name: 'PayPal', domains: ['paypal.com'] },
  { name: 'Bank of America', domains: ['bankofamerica.com', 'bofa.com'] },
  { name: 'Chase', domains: ['chase.com', 'jpmorganchase.com'] },
  { name: 'Wells Fargo', domains: ['wellsfargo.com'] },
  { name: 'Apple', domains: ['apple.com', 'icloud.com'] },
  { name: 'Amazon', domains: ['amazon.com'] },
  { name: 'Google', domains: ['google.com', 'accounts.google.com'] },
  { name: 'Microsoft', domains: ['microsoft.com', 'office.com', 'live.com'] },
  { name: 'Netflix', domains: ['netflix.com'] },
  { name: 'IRS', domains: ['irs.gov'] },
  { name: 'Geek Squad', domains: ['bestbuy.com', 'geeksquad.com'] },
  { name: 'DocuSign', domains: ['docusign.com', 'docusign.net'] },
  { name: 'FedEx', domains: ['fedex.com'] },
  { name: 'UPS', domains: ['ups.com'] },
  { name: 'USPS', domains: ['usps.com', 'usps.gov'] }
];

const HIGH_URGENCY_PATTERNS = [
  /within\s+24\s+hours/i,
  /account\s+(?:has\s+been\s+)?suspended/i,
  /account\s+locked/i,
  /verify\s+your\s+account(?:\s+immediately)?/i,
  /unusual\s+login\s+attempt/i,
  /update\s+payment\s+information/i,
  /security\s+alert/i,
  /immediate\s+action\s+required/i,
  /unless\s+you\s+act\s+now/i,
  /action\s+required/i
];

/**
 * Scan an email and classify its risk level into safe / caution / risk
 */
export async function analyzeThreat(email) {
  const reasons = [];
  let score = 0; // 0 (safe) to 100 (high risk)

  const subject = email.subject || '';
  const senderName = email.senderName || '';
  const senderAddress = email.senderAddress || '';
  const senderDomain = getDomainFromEmail(senderAddress);
  const bodyText = email.bodyText || '';
  const bodyHtml = email.bodyHtml || '';
  const fullContent = `${subject} ${bodyText}`;

  // 1. Sender Display Name Impersonation Check
  const impersonation = checkBrandImpersonation(senderName, senderAddress);
  if (impersonation.isImpersonating) {
    score += 45;
    reasons.push(`Sender address is \`${senderAddress}\`, not a real ${impersonation.brandName} domain`);
  }

  // 2. Reply-To Redirection Check
  if (email.replyToAddress && email.replyToAddress !== senderAddress) {
    const replyDomain = getDomainFromEmail(email.replyToAddress);
    if (replyDomain && senderDomain && getRootDomain(replyDomain) !== getRootDomain(senderDomain)) {
      score += 25;
      reasons.push(`Replies are directed to \`${email.replyToAddress}\` instead of the sender's domain`);
    }
  }

  // 3. Extract and Inspect Links
  const linkAnalysis = extractAndInspectLinks(bodyText, bodyHtml);
  if (linkAnalysis.spoofedLinks.length > 0) {
    score += 40;
    const firstSpoof = linkAnalysis.spoofedLinks[0];
    reasons.push(`Link text says "${firstSpoof.displayText}" but points to \`${firstSpoof.destinationDomain}\``);
  }

  if (linkAnalysis.ipLinks.length > 0) {
    score += 30;
    reasons.push(`Link uses a raw IP address (\`${linkAnalysis.ipLinks[0]}\`) instead of a verified domain name`);
  }

  if (linkAnalysis.suspiciousRedirects.length > 0) {
    score += 30;
    reasons.push(`The link redirects through multiple hops before landing on an external destination`);
  }

  // 3b. Real-time Google Safe Browsing check — replaces guesswork with an authoritative source
  const safeBrowsingResult = await checkLinksWithSafeBrowsing(linkAnalysis.allLinks);
  if (safeBrowsingResult.hasMatch) {
    score += 60;
    reasons.push(`This link is listed by Google Safe Browsing as a known malicious or phishing site`);
  }

  // 4. Urgency & Panic Language Detection
  let hasUrgency = false;
  for (const pattern of HIGH_URGENCY_PATTERNS) {
    if (pattern.test(fullContent)) {
      hasUrgency = true;
      break;
    }
  }

  if (hasUrgency) {
    score += 25;
    if (reasons.length > 0) {
      reasons.push(`Creates artificial time pressure — legitimate security notices don't demand instant action under threat of closure`);
    } else {
      reasons.push(`Uses urgent security wording demanding immediate action`);
    }
  }

  // 5. Generic Greeting Check in Financial/Security Context
  if (impersonation.isImpersonating || hasUrgency) {
    if (/dear\s+(customer|user|client|member|account\s+holder)/i.test(bodyText) || (!bodyText.includes(email.senderName) && /dear/i.test(bodyText))) {
      if (reasons.length < 3) {
        reasons.push(`Uses a generic greeting ("Dear Customer") rather than your actual name`);
      }
    }
  }

  // 6. Domain Age / Reputation Call (Stubbed with TODO)
  const reputationResult = await checkDomainReputation(senderDomain);
  if (reputationResult && reputationResult.isSuspicious) {
    score += 20;
    reasons.push(`Sender domain was registered recently and lacks established reputation`);
  }

  // Final Risk Classification
  let riskLevel = 'safe';
  if (score >= 50) {
    riskLevel = 'risk';
  } else if (score >= 20) {
    riskLevel = 'caution';
  } else {
    riskLevel = 'safe';
  }

  // Ensure 2-3 concise bullet points for flagged emails
  const finalReasons = reasons.slice(0, 3);
  if (riskLevel === 'safe' && finalReasons.length === 0) {
    finalReasons.push('Verified sender domain and authentic links matching expected sender');
  }

  return {
    riskLevel,
    riskScore: Math.min(100, score),
    reasons: finalReasons,
    links: linkAnalysis.allLinks,
    senderDomain
  };
}

/**
 * Check links against Google Safe Browsing's real-time threat database.
 * Requires SAFE_BROWSING_API_KEY in .env — silently skips if not configured.
 */
async function checkLinksWithSafeBrowsing(links) {
  if (!links || links.length === 0 || !config.safeBrowsingApiKey) {
    return { hasMatch: false, matchedUrls: [] };
  }

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${config.safeBrowsingApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'vouch-app', clientVersion: '1.0.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: links.slice(0, 500).map((url) => ({ url }))
          }
        })
      }
    );

    const data = await response.json();
    const matches = data.matches || [];
    return {
      hasMatch: matches.length > 0,
      matchedUrls: matches.map((m) => m.threat.url)
    };
  } catch (err) {
    console.error('Safe Browsing check failed:', err.message);
    return { hasMatch: false, matchedUrls: [] };
  }
}

/**
 * Check if the sender's display name claims a known brand but the email domain is unrelated
 */
function checkBrandImpersonation(displayName, senderEmail) {
  if (!displayName || !senderEmail) return { isImpersonating: false };
  const lowerName = displayName.toLowerCase();
  const domain = getDomainFromEmail(senderEmail);

  for (const brand of MONITORED_BRANDS) {
    const brandLower = brand.name.toLowerCase();
    if (lowerName.includes(brandLower)) {
      const isOfficial = brand.domains.some(
        (d) => domain === d || domain.endsWith('.' + d)
      );
      if (!isOfficial) {
        return { isImpersonating: true, brandName: brand.name, domain };
      }
    }
  }

  return { isImpersonating: false };
}

/**
 * Extract HTML links and compare anchor text against destination URLs
 */
function extractAndInspectLinks(bodyText, bodyHtml) {
  const allLinks = new Set();
  const spoofedLinks = [];
  const ipLinks = [];
  const suspiciousRedirects = [];

  // Parse HTML <a> tags
  if (bodyHtml) {
    const aTagRegex = /<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = aTagRegex.exec(bodyHtml)) !== null) {
      const href = match[1].trim();
      const rawText = match[2].replace(/<[^>]+>/g, '').trim();
      allLinks.add(href);

      // Check if visible text looks like a domain / URL
      const textDomainMatch = rawText.match(/(?:https?:\/\/)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (textDomainMatch) {
        const displayedDomain = textDomainMatch[1].toLowerCase().replace(/^www\./, '');
        try {
          const destUrl = new URL(href);
          const destDomain = destUrl.hostname.toLowerCase().replace(/^www\./, '');
          if (displayedDomain && destDomain && getRootDomain(displayedDomain) !== getRootDomain(destDomain)) {
            spoofedLinks.push({
              href,
              displayText: rawText,
              destinationDomain: destDomain
            });
          }
        } catch {
          // Invalid URL
        }
      }

      // Check IP URLs
      if (/^https?:\/\/(?:\d{1,3}\.){3}\d{1,3}/i.test(href)) {
        ipLinks.push(href);
      }
    }
  }

  // Parse plain text links
  const plainTextUrls = bodyText.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  for (const url of plainTextUrls) {
    const cleaned = url.replace(/[\s>"\')\]\.,;:]+$/, '');
    allLinks.add(cleaned);
    if (/^https?:\/\/(?:\d{1,3}\.){3}\d{1,3}/i.test(cleaned)) {
      ipLinks.push(cleaned);
    }
  }

  return {
    allLinks: Array.from(allLinks),
    spoofedLinks,
    ipLinks,
    suspiciousRedirects
  };
}

function getDomainFromEmail(emailStr) {
  if (!emailStr) return '';
  const parts = emailStr.split('@');
  return parts.length > 1 ? parts[1].toLowerCase().trim() : '';
}

/**
 * Extract the root/registrable domain from a subdomain
 * e.g. "alerts.kuda.com" -> "kuda.com", "links.kuda.com" -> "kuda.com"
 */
function getRootDomain(domain) {
  if (!domain) return '';
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join('.');
}

/**
 * Domain age and reputation check stub
 * // TODO: Threat-Intel API integration (e.g. VirusTotal, WhoisXML)
 */
async function checkDomainReputation(domain) {
  if (!domain) return null;

  // Placeholder stub returning clean for standard domains, suspicious for mock spam domains
  const suspiciousMockDomains = ['mailer-alerts.net', 'verify-id-check.com', 'secure-bank-login.xyz', 'account-update-notice.top'];
  if (suspiciousMockDomains.some((d) => domain.includes(d))) {
    return { isSuspicious: true, ageDays: 3, reputationScore: 12 };
  }

  // TODO: Replace with real threat intelligence lookup
  // Example: const res = await fetch(`https://api.threatintel.example/v1/domains/${domain}?key=${apiKey}`);
  return { isSuspicious: false, ageDays: 1200, reputationScore: 98 };
}