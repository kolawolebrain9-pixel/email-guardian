/**
 * Brand Registry & Threat Detection Constants
 *
 * Provides authoritative definitions of high-value brands targeted by phishers,
 * their legitimate registrable domains, service keywords for impersonation gating,
 * and lists of known freemail providers, legitimate ESPs, and risky file extensions.
 */

export const BRAND_REGISTRY = {
  paypal: {
    name: 'PayPal',
    officialDomains: ['paypal.com', 'paypal.me', 'paypal-communication.com', 'paypal-community.com'],
    serviceWords: ['security', 'support', 'billing', 'invoice', 'account', 'verification', 'service', 'team', 'update', 'care', 'notice'],
    isAmbiguous: false,
    category: 'financial'
  },
  bofa: {
    name: 'Bank of America',
    officialDomains: ['bankofamerica.com', 'bofa.com', 'merrill.com', 'merrilledge.com'],
    serviceWords: ['online', 'banking', 'alert', 'security', 'customer', 'service', 'fraud', 'card', 'account', 'notice'],
    isAmbiguous: false,
    category: 'financial'
  },
  chase: {
    name: 'Chase',
    officialDomains: ['chase.com', 'jpmorganchase.com', 'jpmorgan.com'],
    serviceWords: ['bank', 'banking', 'online', 'card', 'credit', 'fraud', 'security', 'alert', 'customer', 'service', 'support', 'account', 'statement'],
    isAmbiguous: true, // "Chase" is also a common first/last name and common verb
    category: 'financial'
  },
  wells_fargo: {
    name: 'Wells Fargo',
    officialDomains: ['wellsfargo.com', 'wellsfargoadvisors.com'],
    serviceWords: ['banking', 'online', 'alert', 'security', 'customer', 'service', 'fraud', 'card', 'account'],
    isAmbiguous: false,
    category: 'financial'
  },
  citi: {
    name: 'Citi',
    officialDomains: ['citi.com', 'citibank.com', 'citigroup.com'],
    serviceWords: ['bank', 'banking', 'card', 'cards', 'online', 'alert', 'security', 'customer', 'service', 'fraud', 'account'],
    isAmbiguous: true, // Sounds like "City"
    category: 'financial'
  },
  apple: {
    name: 'Apple',
    officialDomains: ['apple.com', 'icloud.com', 'itunes.com'],
    serviceWords: ['support', 'id', 'billing', 'receipt', 'invoice', 'security', 'care', 'store', 'order', 'account', 'cloud', 'service', 'team'],
    isAmbiguous: true, // "Apple" is a common word, place name, and surname
    category: 'tech'
  },
  amazon: {
    name: 'Amazon',
    officialDomains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.ca', 'amazon.co.jp', 'amazon.es', 'amazon.it', 'primevideo.com', 'aws.amazon.com'],
    serviceWords: ['order', 'shipping', 'delivery', 'pay', 'prime', 'support', 'billing', 'account', 'customer', 'service', 'refund', 'fulfillment', 'store', 'security'],
    isAmbiguous: true, // "Amazon" is also a river, geographical region, or mythical figure
    category: 'tech'
  },
  google: {
    name: 'Google',
    officialDomains: ['google.com', 'accounts.google.com', 'gmail.com', 'youtube.com', 'workspace.google.com'],
    serviceWords: ['account', 'security', 'support', 'workspace', 'cloud', 'drive', 'alert', 'team', 'admin'],
    isAmbiguous: false,
    category: 'tech'
  },
  microsoft: {
    name: 'Microsoft',
    officialDomains: ['microsoft.com', 'office.com', 'live.com', 'outlook.com', 'microsoftonline.com', 'azure.com', 'xbox.com'],
    serviceWords: ['account', 'security', 'support', '365', 'office', 'teams', 'admin', 'billing', 'alert', 'compliance'],
    isAmbiguous: false,
    category: 'tech'
  },
  netflix: {
    name: 'Netflix',
    officialDomains: ['netflix.com'],
    serviceWords: ['membership', 'subscription', 'billing', 'payment', 'account', 'update', 'support'],
    isAmbiguous: false,
    category: 'media'
  },
  docusign: {
    name: 'DocuSign',
    officialDomains: ['docusign.com', 'docusign.net'],
    serviceWords: ['signature', 'signing', 'document', 'envelope', 'completed', 'review', 'sign', 'electronic'],
    isAmbiguous: false,
    category: 'business'
  },
  dhl: {
    name: 'DHL',
    officialDomains: ['dhl.com', 'dhl-express.com', 'dhl.de'],
    serviceWords: ['express', 'tracking', 'package', 'delivery', 'parcel', 'shipment', 'support', 'courier', 'customs'],
    isAmbiguous: false,
    category: 'shipping'
  },
  fedex: {
    name: 'FedEx',
    officialDomains: ['fedex.com'],
    serviceWords: ['tracking', 'delivery', 'express', 'ground', 'parcel', 'shipment', 'package', 'support', 'billing'],
    isAmbiguous: false,
    category: 'shipping'
  },
  ups: {
    name: 'UPS',
    officialDomains: ['ups.com'],
    serviceWords: ['tracking', 'delivery', 'parcel', 'shipment', 'freight', 'support', 'package', 'courier'],
    isAmbiguous: true, // "ups" is a common word
    category: 'shipping'
  },
  usps: {
    name: 'USPS',
    officialDomains: ['usps.com', 'usps.gov'],
    serviceWords: ['tracking', 'delivery', 'parcel', 'postal', 'post office', 'package', 'mail', 'support'],
    isAmbiguous: false,
    category: 'shipping'
  },
  geek_squad: {
    name: 'Geek Squad',
    officialDomains: ['bestbuy.com', 'geeksquad.com'],
    serviceWords: ['support', 'protection', 'renewal', 'subscription', 'billing', 'invoice', 'membership', 'antivirus', 'order'],
    isAmbiguous: false,
    category: 'services'
  },
  irs: {
    name: 'IRS',
    officialDomains: ['irs.gov'],
    serviceWords: ['tax', 'refund', 'internal revenue', 'payment', 'audit', 'notice', 'form', 'filing', 'treasury'],
    isAmbiguous: true,
    category: 'government'
  },
  stripe: {
    name: 'Stripe',
    officialDomains: ['stripe.com'],
    serviceWords: ['payments', 'billing', 'invoice', 'receipt', 'payout', 'support', 'charge', 'account'],
    isAmbiguous: true, // "Stripe" is a common word
    category: 'financial'
  }
};

/**
 * Common public and free webmail domains.
 * Senders claiming enterprise/banking/service brands from these domains are high-confidence impersonators.
 */
export const FREEMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'myyahoo.com',
  'rocketmail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'mail.com',
  'email.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'yandex.com',
  'tutanota.com',
  'tutamail.com'
]);

/**
 * Reputable Email Service Providers (ESPs) and transactional senders.
 * When links route through these services, the suspicious-redirect penalty is reduced ONLY if
 * the sender's domain passes cryptographic authentication (SPF/DKIM/DMARC) and matches From.
 */
export const KNOWN_ESPS = [
  { name: 'SendGrid', domains: ['sendgrid.net', 'sendgrid.com', 'ct.sendgrid.net'] },
  { name: 'Mailchimp', domains: ['mailchimpapp.net', 'list-manage.com', 'mcsv.net', 'mailchimp.com'] },
  { name: 'Amazon SES', domains: ['amazonses.com', 'awstrack.me'] },
  { name: 'HubSpot', domains: ['hubspotlinks.com', 'hubspot.com', 'hs-send.com'] },
  { name: 'Salesforce Marketing Cloud', domains: ['exacttarget.com', 'c.exacttarget.com', 'marketingcloud.com'] },
  { name: 'Klaviyo', domains: ['klaviyo.com', 'klaviyomail.com', 'ctrk.klaviyo.com'] },
  { name: 'Braze', domains: ['braze.com', 'appboy.com'] },
  { name: 'Substack', domains: ['substack.com'] },
  { name: 'Postmark', domains: ['postmarkapp.com', 'pstmrk.it'] },
  { name: 'Mailgun', domains: ['mailgun.org', 'mailgun.net'] }
];

/**
 * High-risk file extensions often delivered in malware and phishing drops
 */
export const RISKY_ATTACHMENT_EXTENSIONS = new Set([
  '.exe', '.scr', '.vbs', '.js', '.bat', '.cmd', '.com', '.cpl',
  '.gadget', '.hta', '.jar', '.jse', '.lnk', '.msc', '.msi', '.msp',
  '.pif', '.reg', '.vb', '.vbe', '.ws', '.wsf', '.wsh', '.iso',
  '.img', '.ps1', '.app', '.dmg'
]);

/**
 * Common link-shortening services
 */
export const LINK_SHORTENER_DOMAINS = new Set([
  'bit.ly',
  'tinyurl.com',
  'is.gd',
  'cutt.ly',
  'ow.ly',
  'buff.ly',
  'rebrand.ly',
  'shorte.st',
  'bc.vc',
  'v.gd',
  'qr.ae',
  't.co'
]);
