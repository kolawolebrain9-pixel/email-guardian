from src.core.email_parser.parser import EmailParser
from src.core.verifier.analyzer import EmailThreatAnalyzer


def test_safe_email_analysis():
    raw_email = b"""From: newsletter@company.com
Reply-To: newsletter@company.com
Subject: Monthly Newsletter - August
Content-Type: text/plain; charset="utf-8"

Here is your monthly update.
Visit https://company.com/blog to read more articles.
"""
    parser = EmailParser()
    analyzer = EmailThreatAnalyzer()

    parsed = parser.parse(raw_email)
    result = analyzer.analyze(parsed)

    assert result.risk_level == "SAFE"
    assert result.risk_score < 25


def test_phishing_email_with_spoofed_link_and_urgency():
    raw_email = b"""From: support@secure-bank.com
Reply-To: attacker123@gmail.com
Subject: Urgent: Account Suspended!
Authentication-Results: mx.google.com; spf=fail; dkim=fail
Content-Type: text/html; charset="utf-8"

<html>
<body>
    <p>Your account has been suspended due to unauthorized activity.</p>
    <p>Verify your account immediately by clicking below:</p>
    <a href="https://scam-site.ru/steal">https://secure-bank.com/verify</a>
</body>
</html>
"""
    parser = EmailParser()
    analyzer = EmailThreatAnalyzer()

    parsed = parser.parse(raw_email)
    result = analyzer.analyze(parsed)

    assert result.risk_level == "HIGH"
    assert result.risk_score >= 50
    # Check that reasons mention key findings
    reasons_text = " ".join(result.reasons)
    assert "spoofed" in reasons_text.lower() or "destination" in reasons_text.lower()
    assert "reply-to" in reasons_text.lower()
    assert "spf" in reasons_text.lower()

