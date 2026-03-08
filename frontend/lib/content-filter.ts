/**
 * Content moderation utilities for filtering spam, profanity, and phishing links
 */

// Common profanity terms (basic list - can be expanded)
const PROFANITY_LIST = [
  'spam',
  'scam',
  'fake',
  'phishing',
  'hack',
  'exploit',
  // Add more terms as needed
];

// Known phishing and malicious domains (basic list - can be expanded)
const PHISHING_DOMAINS = [
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  't.co',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  // Suspicious TLDs often used for phishing
  '.tk',
  '.ml',
  '.ga',
  '.cf',
  '.gq',
  // Add more known phishing domains as needed
];

// URL regex pattern to detect links in content
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

export interface ContentFilterResult {
  isClean: boolean;
  reason?: string;
  detectedIssues: string[];
}

/**
 * Check if content contains profanity
 */
export function containsProfanity(content: string): boolean {
  const lowerContent = content.toLowerCase();
  return PROFANITY_LIST.some(term => {
    // Match whole words only to avoid false positives
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(lowerContent);
  });
}

/**
 * Extract URLs from content
 */
export function extractUrls(content: string): string[] {
  const matches = content.match(URL_REGEX);
  return matches || [];
}

/**
 * Check if a URL contains a suspicious or phishing domain
 */
export function isPhishingUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return PHISHING_DOMAINS.some(domain => lowerUrl.includes(domain));
}

/**
 * Check if content contains phishing links
 */
export function containsPhishingLinks(content: string): boolean {
  const urls = extractUrls(content);
  return urls.some(url => isPhishingUrl(url));
}

/**
 * Main content filter function
 * Returns whether content is clean and any detected issues
 */
export function filterContent(content: string): ContentFilterResult {
  const detectedIssues: string[] = [];

  // Check for profanity
  if (containsProfanity(content)) {
    detectedIssues.push('profanity');
  }

  // Check for phishing links
  const urls = extractUrls(content);
  const phishingUrls = urls.filter(url => isPhishingUrl(url));
  if (phishingUrls.length > 0) {
    detectedIssues.push(`suspicious links: ${phishingUrls.join(', ')}`);
  }

  // Check for excessive links (potential spam)
  if (urls.length > 3) {
    detectedIssues.push('excessive links (possible spam)');
  }

  const isClean = detectedIssues.length === 0;
  const reason = detectedIssues.length > 0 
    ? `Content blocked: ${detectedIssues.join('; ')}`
    : undefined;

  return {
    isClean,
    reason,
    detectedIssues,
  };
}

/**
 * Validate content before posting
 * Throws an error if content is not clean
 */
export function validateContent(content: string): void {
  const result = filterContent(content);
  if (!result.isClean) {
    throw new Error(result.reason || 'Content contains inappropriate material');
  }
}
