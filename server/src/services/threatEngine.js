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

  // 6. Domain Age / Reputation Call
  const reputationResult = await checkDomainReputation(senderDomain);
  if (reputationResult && reputationResult.isSuspicious) {
    score += 25;
    reasons.push(reputationResult.reason || `Sender domain was registered recently and lacks established reputation`);
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

  // Hard signals: concrete technical evidence of an attack.
  // A user's earlier "safe" vouch must NEVER silence these.
  const hardSignals = [];
  if (safeBrowsingResult.hasMatch) hardSignals.push('safe_browsing');
  if (impersonation.isImpersonating) hardSignals.push('brand_impersonation');
  if (linkAnalysis.spoofedLinks.length > 0) hardSignals.push('spoofed_link');
  if (linkAnalysis.ipLinks.length > 0) hardSignals.push('ip_link');
  if (reasons.some((r) => r.startsWith('Replies are directed to'))) hardSignals.push('reply_to_redirect');
  if (reputationResult && reputationResult.isSuspicious && reputationResult.ageDays !== null && reputationResult.ageDays < 7) {
    hardSignals.push('newly_registered_domain');
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
    senderDomain,
    hardSignals
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
export function getRootDomain(domain) {
  if (!domain) return '';
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join('.');
}

// In-memory reputation cache: rootDomain -> { result, cachedAt }
const domainReputationCache = new Map();
const REPUTATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Well-established, high-trust domains (skips external network calls)
const ESTABLISHED_DOMAINS = new Set([
  'google.com', 'accounts.google.com', 'gmail.com', 'youtube.com',
  'apple.com', 'icloud.com',
  'microsoft.com', 'office.com', 'live.com', 'outlook.com', 'hotmail.com',
  'amazon.com', 'aws.amazon.com',
  'paypal.com',
  'chase.com', 'jpmorganchase.com', 'bankofamerica.com', 'bofa.com', 'wellsfargo.com', 'citigroup.com', 'citi.com',
  'netflix.com', 'spotify.com', 'linkedin.com', 'github.com', 'facebook.com', 'twitter.com', 'x.com',
  'stripe.com', 'uber.com', 'airbnb.com', 'zoom.us', 'slack.com', 'salesforce.com', 'adobe.com', 'dropbox.com'
]);

// Known suspicious / mock domains
const KNOWN_SUSPICIOUS_DOMAINS = new Set([
  'mailer-alerts.net',
  'verify-id-check.com',
  'secure-bank-login.xyz',
  'account-update-notice.top',
  'paypal-security-update.online',
  'apple-support-verify.click'
]);

// High-abuse top-level domains frequently leveraged for disposable phishing
const HIGH_ABUSE_TLDS = new Set([
  'top', 'xyz', 'click', 'icu', 'buzz', 'rest', 'cam', 'work', 'sbs', 'monster', 'cfd', 'fit', 'hair'
]);

/**
 * Check domain registration age and reputation score.
 * 1. Fast-path in-memory cache check.
 * 2. Instant recognition for established top brands.
 * 3. Immediate catch for known abusive / phishing hosts.
 * 4. Threat Intel API (WhoisXML / VirusTotal) if configured.
 * 5. Free, standard ICANN RDAP (Registration Data Access Protocol) query with 2.5s timeout.
 * 6. High-abuse TLD heuristic fallback for offline/unreachable environments.
 */
export async function checkDomainReputation(domain) {
  if (!domain) return null;
  const lowerDomain = domain.toLowerCase().trim();
  const root = getRootDomain(lowerDomain);

  // 1. Check in-memory cache
  const cached = domainReputationCache.get(root);
  if (cached && (Date.now() - cached.cachedAt) < REPUTATION_CACHE_TTL_MS) {
    return cached.result;
  }

  // 2. High-trust established domains
  if (ESTABLISHED_DOMAINS.has(root) || ESTABLISHED_DOMAINS.has(lowerDomain)) {
    const result = { isSuspicious: false, ageDays: 5000, reputationScore: 99, source: 'established_trust' };
    domainReputationCache.set(root, { result, cachedAt: Date.now() });
    return result;
  }

  // 3. Known suspicious mock/phishing domains
  if (KNOWN_SUSPICIOUS_DOMAINS.has(root) || KNOWN_SUSPICIOUS_DOMAINS.has(lowerDomain)) {
    const result = {
      isSuspicious: true,
      ageDays: 2,
      reputationScore: 10,
      reason: `Sender domain (\`${root}\`) is listed as a known phishing or untrusted host`,
      source: 'threat_blacklist'
    };
    domainReputationCache.set(root, { result, cachedAt: Date.now() });
    return result;
  }

  let result = null;

  // 4. WhoisXML API integration (if key provided in .env)
  if (config.whoisApiKey) {
    try {
      const resp = await fetch(
        `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${config.whoisApiKey}&domainName=${encodeURIComponent(root)}&outputFormat=JSON`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        const createdDateStr = data?.WhoisRecord?.createdDate || data?.WhoisRecord?.registryData?.createdDate;
        if (createdDateStr) {
          const ageDays = Math.max(0, Math.round((Date.now() - new Date(createdDateStr).getTime()) / (1000 * 60 * 60 * 24)));
          const isSuspicious = ageDays < 30;
          result = {
            isSuspicious,
            ageDays,
            reputationScore: isSuspicious ? Math.max(10, ageDays * 2) : Math.min(98, 50 + Math.round(ageDays / 30)),
            reason: isSuspicious ? `Sender domain was registered recently (${ageDays} days ago) and lacks established reputation` : null,
            source: 'whoisxml'
          };
        }
      }
    } catch {
      // Fall through to RDAP
    }
  }

  // 5. Standard ICANN RDAP Protocol (RFC 7480-7484) — zero config, free, authoritative
  if (!result) {
    try {
      const resp = await fetch(`https://rdap.org/domain/${encodeURIComponent(root)}`, {
        signal: AbortSignal.timeout(2500),
        headers: { Accept: 'application/rdap+json, application/json' }
      });
      if (resp.ok) {
        const data = await resp.json();
        const events = Array.isArray(data?.events) ? data.events : [];
        const regEvent = events.find((e) => e.eventAction === 'registration') || events.find((e) => e.eventAction === 'transfer');
        if (regEvent?.eventDate) {
          const ageDays = Math.max(0, Math.round((Date.now() - new Date(regEvent.eventDate).getTime()) / (1000 * 60 * 60 * 24)));
          const isSuspicious = ageDays < 30;
          result = {
            isSuspicious,
            ageDays,
            reputationScore: isSuspicious ? Math.max(10, ageDays * 2) : Math.min(98, 50 + Math.round(ageDays / 30)),
            reason: isSuspicious ? `Sender domain was registered recently (${ageDays} days ago) and lacks established reputation` : null,
            source: 'rdap'
          };
        }
      }
    } catch {
      // Fall through to TLD heuristic
    }
  }

  // 6. High-abuse TLD / Heuristic Fallback
  if (!result) {
    const tld = root.split('.').pop() || '';
    if (HIGH_ABUSE_TLDS.has(tld)) {
      result = {
        isSuspicious: true,
        ageDays: null,
        reputationScore: 35,
        reason: `Sender domain uses a high-risk top-level domain (.${tld}) frequently leveraged for disposable phishing attacks`,
        source: 'tld_heuristic'
      };
    } else {
      result = {
        isSuspicious: false,
        ageDays: null,
        reputationScore: 75,
        source: 'default_neutral'
      };
    }
  }

  domainReputationCache.set(root, { result, cachedAt: Date.now() });
  return result;
}