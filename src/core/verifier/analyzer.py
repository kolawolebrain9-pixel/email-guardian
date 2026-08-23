from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
import re

from src.core.email_parser.parser import ParsedEmail


@dataclass
class ThreatAnalysis:
    risk_level: str
    risk_score: int
    reasons: List[str]
    findings: Dict[str, Any] = field(default_factory=dict)


class EmailThreatAnalyzer:
    """Multi-factor threat analysis engine evaluating email headers, links, domains, and content."""

    DANGEROUS_ATTACHMENT_EXTENSIONS = {
        '.exe', '.scr', '.bat', '.vbs', '.js', '.hta', '.iso', '.vbe', '.wsf', '.docm', '.xlsm'
    }

    HIGH_RISK_PHRASES = [
        "account has been suspended",
        "account suspended",
        "verify your account immediately",
        "verify your identity",
        "unauthorized login attempt",
        "update payment information",
        "update your billing",
        "password will expire",
        "urgent action required",
        "wire transfer request",
        "purchase gift cards",
        "click here to unlock",
        "confirm your credit card"
    ]

    MEDIUM_RISK_PHRASES = [
        "immediate attention required",
        "security alert",
        "click below to confirm",
        "action required",
        "billing statement attached",
        "undelivered message",
        "tax refund notification"
    ]

    def analyze(self, email_data: ParsedEmail) -> ThreatAnalysis:
        reasons: List[str] = []
        findings: Dict[str, Any] = {
            "link_threats": [],
            "header_threats": [],
            "content_threats": [],
            "attachment_threats": []
        }
        score = 0

        # 1. Inspect Link Threats
        score += self._check_links(email_data, reasons, findings)

        # 2. Inspect Sender & Reply-To Domain Alignment
        score += self._check_domains(email_data, reasons, findings)

        # 3. Inspect Authentication Headers (SPF, DKIM, DMARC)
        score += self._check_auth_headers(email_data, reasons, findings)

        # 4. Inspect Content & Urgency Indicators
        score += self._check_content_threats(email_data, reasons, findings)

        # 5. Inspect Attachments
        score += self._check_attachments(email_data, reasons, findings)

        # Normalize score
        score = max(0, min(100, score))

        # Determine risk level
        if score >= 50:
            risk_level = "HIGH"
        elif score >= 20:
            risk_level = "MEDIUM"
        else:
            risk_level = "SAFE"

        if not reasons:
            reasons.append("No immediate phishing indicators detected.")

        return ThreatAnalysis(
            risk_level=risk_level,
            risk_score=score,
            reasons=reasons,
            findings=findings
        )

    def _check_links(self, email_data: ParsedEmail, reasons: List[str], findings: Dict[str, Any]) -> int:
        score = 0
        mismatch_count = 0
        ip_count = 0

        for detail in email_data.link_details:
            url = detail.get("url", "")
            
            # Check spoofed / mismatched anchor text
            if detail.get("is_mismatch"):
                mismatch_count += 1
                findings["link_threats"].append({
                    "type": "spoofed_text",
                    "url": url,
                    "text": detail.get("text")
                })
            
            # Check IP address URLs
            if detail.get("is_ip"):
                ip_count += 1
                findings["link_threats"].append({
                    "type": "ip_address_url",
                    "url": url
                })

            # Check dangerous file downloads in URLs
            try:
                path = urlparse(url).path.lower()
                for ext in self.DANGEROUS_ATTACHMENT_EXTENSIONS:
                    if path.endswith(ext):
                        score += 35
                        reasons.append(f"Link points directly to an executable/dangerous file: {url}")
                        break
            except Exception:
                pass

        if mismatch_count > 0:
            score += 45
            reasons.append(f"Found {mismatch_count} spoofed link(s) where displayed text hides a different destination domain.")

        if ip_count > 0:
            score += 30
            reasons.append(f"Found {ip_count} link(s) using bare IP addresses instead of trusted domain names.")

        if len(email_data.links) > 15:
            score += 15
            reasons.append(f"Contains an unusually high number of links ({len(email_data.links)} links).")

        return score

    def _check_domains(self, email_data: ParsedEmail, reasons: List[str], findings: Dict[str, Any]) -> int:
        score = 0
        sender = email_data.sender
        reply_to = email_data.reply_to

        if sender and reply_to and sender != reply_to:
            sender_domain = sender.split("@")[-1].lower() if "@" in sender else ""
            reply_domain = reply_to.split("@")[-1].lower() if "@" in reply_to else ""

            if sender_domain and reply_domain and sender_domain != reply_domain:
                # Severe flag if sender claims a corporate domain but reply-to is a public webmail (e.g. gmail/yahoo)
                public_webmails = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com"}
                if reply_domain in public_webmails and sender_domain not in public_webmails:
                    score += 40
                    reasons.append(f"Suspicious Reply-To redirection: Sender domain '{sender_domain}' redirects replies to free webmail '{reply_to}'.")
                else:
                    score += 20
                    reasons.append(f"Reply-To domain mismatch: Sender domain is '{sender_domain}', but responses go to '{reply_domain}'.")

        return score

    def _check_auth_headers(self, email_data: ParsedEmail, reasons: List[str], findings: Dict[str, Any]) -> int:
        score = 0
        headers = email_data.headers

        # Check SPF / DKIM / DMARC fail in Authentication-Results or Received-SPF
        auth_results = headers.get("authentication-results", "").lower()
        received_spf = headers.get("received-spf", "").lower()

        if "spf=fail" in auth_results or received_spf.startswith("fail"):
            score += 35
            reasons.append("Email failed SPF sender verification (SPF=fail).")
            findings["header_threats"].append("SPF validation failed")
        elif "spf=softfail" in auth_results or received_spf.startswith("softfail"):
            score += 15
            reasons.append("Email received SPF softfail (unauthorized sending server).")

        if "dkim=fail" in auth_results:
            score += 30
            reasons.append("Email failed cryptographic DKIM signature verification (DKIM=fail).")
            findings["header_threats"].append("DKIM signature invalid")

        if "dmarc=fail" in auth_results:
            score += 35
            reasons.append("Email failed domain DMARC authentication policy (DMARC=fail).")
            findings["header_threats"].append("DMARC check failed")

        return score

    def _check_content_threats(self, email_data: ParsedEmail, reasons: List[str], findings: Dict[str, Any]) -> int:
        score = 0
        full_text = f"{email_data.subject} {email_data.body_text}".lower()

        for phrase in self.HIGH_RISK_PHRASES:
            if phrase in full_text:
                score += 25
                reasons.append(f"Detected high-urgency credential/security lure: '{phrase}'.")
                findings["content_threats"].append(phrase)
                break  # Count highest match once

        for phrase in self.MEDIUM_RISK_PHRASES:
            if phrase in full_text:
                score += 10
                reasons.append(f"Detected urgency indicator: '{phrase}'.")
                findings["content_threats"].append(phrase)
                break

        return score

    def _check_attachments(self, email_data: ParsedEmail, reasons: List[str], findings: Dict[str, Any]) -> int:
        score = 0
        for attachment in email_data.attachments:
            fname = attachment.get("filename", "").lower()
            for ext in self.DANGEROUS_ATTACHMENT_EXTENSIONS:
                if fname.endswith(ext):
                    score += 50
                    reasons.append(f"Contains potentially hazardous executable attachment: '{attachment.get('filename')}'.")
                    findings["attachment_threats"].append(fname)
                    break
        return score

