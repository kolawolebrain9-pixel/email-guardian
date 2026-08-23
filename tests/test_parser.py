from src.core.email_parser.parser import EmailParser


def test_parse_plain_text_email():
    raw_email = b"""From: "Security Team" <security@example.com>
To: user@example.com
Subject: Welcome to the Platform
Message-ID: <msg-001@example.com>
Content-Type: text/plain; charset="utf-8"

Hello!
Please visit https://example.com/welcome to get started.
Contact support if you need assistance.
"""
    parser = EmailParser()
    parsed = parser.parse(raw_email)

    assert parsed.sender == "security@example.com"
    assert parsed.sender_name == "Security Team"
    assert parsed.subject == "Welcome to the Platform"
    assert parsed.message_id == "<msg-001@example.com>"
    assert "https://example.com/welcome" in parsed.links
    assert len(parsed.links) == 1
    assert "Hello!" in parsed.body_text


def test_parse_html_with_spoofed_link():
    raw_email = b"""From: service@paypal-alerts.net
Reply-To: phisher@gmail.com
Subject: Account Suspended!
Content-Type: text/html; charset="utf-8"

<html>
<body>
    <p>Your account is locked.</p>
    <a href="https://evil-phishing-domain.com/login">https://www.paypal.com/login</a>
    <a href="https://192.168.1.100/reset">Reset IP</a>
</body>
</html>
"""
    parser = EmailParser()
    parsed = parser.parse(raw_email)

    assert parsed.sender == "service@paypal-alerts.net"
    assert parsed.reply_to == "phisher@gmail.com"
    assert len(parsed.links) == 2

    # Verify link details detect the mismatch and IP address
    mismatch_item = next((d for d in parsed.link_details if "evil-phishing" in d["url"]), None)
    assert mismatch_item is not None
    assert mismatch_item["is_mismatch"] is True

    ip_item = next((d for d in parsed.link_details if "192.168.1.100" in d["url"]), None)
    assert ip_item is not None
    assert ip_item["is_ip"] is True


def test_clean_url_strips_html_tags_and_punctuation():
    parser = EmailParser()
    cleaned1 = parser._clean_url('https://example.com/page">')
    cleaned2 = parser._clean_url('https://example.com/page,')
    cleaned3 = parser._clean_url('https://example.com/page.)')

    assert cleaned1 == "https://example.com/page"
    assert cleaned2 == "https://example.com/page"
    assert cleaned3 == "https://example.com/page"

