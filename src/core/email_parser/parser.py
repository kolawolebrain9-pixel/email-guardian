import email
from email import policy
import email.utils
from html.parser import HTMLParser
import re
from urllib.parse import urlparse
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple


@dataclass
class ParsedEmail:
    message_id: str
    subject: str
    sender: str
    sender_name: str
    reply_to: Optional[str]
    reply_to_name: Optional[str]
    to: Optional[str]
    body_text: str
    body_html: Optional[str]
    links: List[str]
    link_details: List[Dict[str, Any]] = field(default_factory=list)
    headers: Dict[str, str] = field(default_factory=dict)
    attachments: List[Dict[str, Any]] = field(default_factory=list)


class _HTMLLinkExtractor(HTMLParser):
    """HTML parser to extract hyperlinks, anchor text, and detect spoofed display URLs."""
    def __init__(self):
        super().__init__()
        self.links: List[Dict[str, str]] = []
        self._current_href = None
        self._current_text = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'a':
            attr_dict = dict(attrs)
            href = attr_dict.get('href')
            if href and (href.startswith('http://') or href.startswith('https://')):
                self._current_href = href.strip()
                self._current_text = []

    def handle_data(self, data):
        if self._current_href:
            self._current_text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == 'a' and self._current_href:
            text = "".join(self._current_text).strip()
            self.links.append({
                "url": self._current_href,
                "text": text
            })
            self._current_href = None
            self._current_text = []


class EmailParser:
    def __init__(self):
        self.url_pattern = re.compile(r'https?://[^\s<>"\')]+', re.IGNORECASE)
        self.ip_pattern = re.compile(r'^https?://(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:/.*)?$', re.IGNORECASE)

    def parse(self, raw_email: bytes) -> ParsedEmail:
        msg = email.message_from_bytes(raw_email, policy=policy.default)
        
        # Extract addresses using RFC standard parser
        sender_name, sender_email = self._extract_address(msg.get('From', ''))
        reply_to_name, reply_to_email = self._extract_address(msg.get('Reply-To', ''))
        _, to_email = self._extract_address(msg.get('To', ''))

        # Extract bodies
        body_text, body_html = self._extract_bodies(msg)

        # Extract and analyze links
        links, link_details = self._extract_and_analyze_links(body_text, body_html)

        # Extract headers dictionary for security/auth checks
        headers = {k.lower(): str(v) for k, v in msg.items()}

        # Extract attachment metadata
        attachments = self._extract_attachments(msg)

        message_id = str(msg.get('Message-ID', '')).strip()

        return ParsedEmail(
            message_id=message_id,
            subject=str(msg.get('Subject', '')).strip(),
            sender=sender_email or "",
            sender_name=sender_name or "",
            reply_to=reply_to_email if reply_to_email else None,
            reply_to_name=reply_to_name if reply_to_name else None,
            to=to_email if to_email else None,
            body_text=body_text,
            body_html=body_html,
            links=links,
            link_details=link_details,
            headers=headers,
            attachments=attachments
        )

    def _extract_address(self, header_value: Any) -> Tuple[str, str]:
        """Extract (name, email_address) safely using email.utils.parseaddr."""
        if not header_value:
            return "", ""
        name, addr = email.utils.parseaddr(str(header_value))
        return name.strip(), addr.strip().lower()

    def _extract_bodies(self, msg) -> Tuple[str, Optional[str]]:
        """Extract plain text and HTML body parts with decoding fallback."""
        text_parts = []
        html_parts = []

        if msg.is_multipart():
            for part in msg.walk():
                if part.is_multipart():
                    continue
                content_type = part.get_content_type()
                content_disposition = str(part.get('Content-Disposition', ''))
                
                # Skip attachments
                if 'attachment' in content_disposition.lower():
                    continue

                try:
                    payload = part.get_content()
                    if isinstance(payload, str):
                        if content_type == 'text/plain':
                            text_parts.append(payload)
                        elif content_type == 'text/html':
                            html_parts.append(payload)
                except Exception:
                    try:
                        raw_bytes = part.get_payload(decode=True)
                        if raw_bytes:
                            charset = part.get_content_charset() or 'utf-8'
                            decoded = raw_bytes.decode(charset, errors='replace')
                            if content_type == 'text/plain':
                                text_parts.append(decoded)
                            elif content_type == 'text/html':
                                html_parts.append(decoded)
                    except Exception:
                        pass
        else:
            content_type = msg.get_content_type()
            try:
                content = msg.get_content()
                if isinstance(content, str):
                    if content_type == 'text/html':
                        html_parts.append(content)
                    else:
                        text_parts.append(content)
            except Exception:
                try:
                    raw_bytes = msg.get_payload(decode=True)
                    if raw_bytes:
                        charset = msg.get_content_charset() or 'utf-8'
                        decoded = raw_bytes.decode(charset, errors='replace')
                        if content_type == 'text/html':
                            html_parts.append(decoded)
                        else:
                            text_parts.append(decoded)
                except Exception:
                    pass

        body_text = "\n\n".join(text_parts).strip()
        body_html = "\n\n".join(html_parts).strip() if html_parts else None

        return body_text, body_html

    def _extract_and_analyze_links(self, text: str, html: Optional[str]) -> Tuple[List[str], List[Dict[str, Any]]]:
        """Extract links from HTML and text, detect mismatches and IP-based links."""
        found_links: Dict[str, Dict[str, Any]] = {}

        # 1. Parse HTML links if HTML body is present
        if html:
            extractor = _HTMLLinkExtractor()
            try:
                extractor.feed(html)
                for item in extractor.links:
                    url = self._clean_url(item["url"])
                    if not url:
                        continue
                    
                    text_label = item["text"]
                    is_mismatch = self._check_mismatch(url, text_label)
                    is_ip = bool(self.ip_pattern.match(url))
                    
                    found_links[url] = {
                        "url": url,
                        "text": text_label,
                        "is_mismatch": is_mismatch,
                        "is_ip": is_ip
                    }
            except Exception:
                pass

        # 2. Extract plain-text URLs from text body only (prevents regex matching inside raw HTML attributes)
        if text:
            raw_urls = self.url_pattern.findall(text)
            for raw_url in raw_urls:
                url = self._clean_url(raw_url)
                if url and url not in found_links:
                    is_ip = bool(self.ip_pattern.match(url))
                    found_links[url] = {
                        "url": url,
                        "text": "",
                        "is_mismatch": False,
                        "is_ip": is_ip
                    }

        unique_urls = list(found_links.keys())
        details = list(found_links.values())
        return unique_urls, details

    def _clean_url(self, url: str) -> str:
        """Strip trailing punctuation, quotes, and brackets from extracted URLs."""
        if not url:
            return ""
        cleaned = re.sub(r'[\s>"\')\]\.,;:]+$', '', url.strip())
        if cleaned.startswith(('http://', 'https://')):
            return cleaned
        return ""

    def _check_mismatch(self, actual_url: str, anchor_text: str) -> bool:
        """Check if visible text looks like a domain or URL that differs from actual URL target."""
        if not anchor_text:
            return False
        
        # If anchor text looks like a URL or domain (e.g. www.paypal.com or http://bank.com)
        domain_match = re.search(r'(?:https?://)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', anchor_text)
        if not domain_match:
            return False

        displayed_domain = domain_match.group(1).lower().removeprefix("www.")
        try:
            actual_domain = urlparse(actual_url).netloc.lower().removeprefix("www.").split(":")[0]
            if displayed_domain and actual_domain:
                return displayed_domain != actual_domain and not actual_domain.endswith("." + displayed_domain)
        except Exception:
            pass
        return False

    def _extract_attachments(self, msg) -> List[Dict[str, Any]]:
        """Extract metadata for attachments."""
        attachments = []
        if msg.is_multipart():
            for part in msg.walk():
                content_disposition = str(part.get('Content-Disposition', ''))
                filename = part.get_filename()
                if filename or 'attachment' in content_disposition.lower():
                    payload = part.get_payload(decode=True)
                    size = len(payload) if payload else 0
                    attachments.append({
                        "filename": filename or "unnamed_attachment",
                        "content_type": part.get_content_type(),
                        "size_bytes": size
                    })
        return attachments