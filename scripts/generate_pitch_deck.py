import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    # 16:9 widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette curated by UI/UX Lead Elena Rostova
    BG_DARK = RGBColor(11, 15, 25)          # Deep obsidian slate #0B0F19
    CARD_BG = RGBColor(22, 31, 48)          # Card container slate #161F30
    CARD_BORDER = RGBColor(38, 52, 78)      # Card border #26344E
    ACCENT_EMERALD = RGBColor(16, 185, 129) # Safe / Trust #10B981
    ACCENT_INDIGO = RGBColor(99, 102, 241)  # Tech / AI #6366F1
    ACCENT_AMBER = RGBColor(245, 158, 11)   # Caution #F59E0B
    ACCENT_CORAL = RGBColor(239, 68, 68)    # Threat / Risk #EF4444
    TEXT_WHITE = RGBColor(248, 250, 252)    # Main Title / Text #F8FAFC
    TEXT_MUTED = RGBColor(148, 163, 184)    # Secondary / Body #94A3B8
    TEXT_ACCENT = RGBColor(52, 211, 153)    # Bright Mint #34D399

    def add_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_DARK
        bg.line.fill.background()
        return bg

    def add_header(slide, category, title, subtitle=""):
        # Category Tag
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.4))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = ACCENT_EMERALD

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(11.7), Inches(0.8))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(28)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_WHITE

        if subtitle:
            p_sub = tf_title.add_paragraph()
            p_sub.text = subtitle
            p_sub.font.size = Pt(13)
            p_sub.font.color.rgb = TEXT_MUTED

    # ==========================================
    # SLIDE 1: COVER SLIDE
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)
    add_bg(s1)

    # Decorative glow card
    center_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(1.2), Inches(10.33), Inches(5.1))
    center_card.fill.solid()
    center_card.fill.fore_color.rgb = CARD_BG
    center_card.line.color.rgb = CARD_BORDER
    center_card.line.width = Pt(1.5)

    # Logo / Badge
    badge = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(5.4), Inches(1.6), Inches(2.53), Inches(0.5))
    badge.fill.solid()
    badge.fill.fore_color.rgb = RGBColor(16, 42, 36)
    badge.line.color.rgb = ACCENT_EMERALD
    badge.line.width = Pt(1)
    tf_b = badge.text_frame
    p_b = tf_b.paragraphs[0]
    p_b.text = "● THE NEXT-GEN DEFENSE"
    p_b.font.size = Pt(10)
    p_b.font.bold = True
    p_b.font.color.rgb = ACCENT_EMERALD
    p_b.alignment = PP_ALIGN.CENTER

    # Main Brand Name
    title_box = s1.shapes.add_textbox(Inches(2.0), Inches(2.3), Inches(9.33), Inches(1.5))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = "VOUCH"
    p.font.size = Pt(56)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.alignment = PP_ALIGN.CENTER

    p2 = tf.add_paragraph()
    p2.text = "The Human-First Email Safety & Collective Defense Network"
    p2.font.size = Pt(20)
    p2.font.color.rgb = ACCENT_EMERALD
    p2.alignment = PP_ALIGN.CENTER

    p3 = tf.add_paragraph()
    p3.text = "Replacing Panic Banners With Actionable Calm and Crowdsourced Immunity"
    p3.font.size = Pt(13)
    p3.font.color.rgb = TEXT_MUTED
    p3.alignment = PP_ALIGN.CENTER

    # 3 Stat Pills at Bottom of Cover
    pills = [
        ("3.4 Billion", "Phishing Emails Sent Daily"),
        ("< 60 Words", "Plain-English Threat Clarity"),
        ("100% Privacy", "Decentralized SHA-256 Hashing")
    ]
    for i, (stat, label) in enumerate(pills):
        px = Inches(2.3 + i * 3.0)
        pill = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, px, Inches(4.5), Inches(2.7), Inches(1.2))
        pill.fill.solid()
        pill.fill.fore_color.rgb = RGBColor(15, 23, 42)
        pill.line.color.rgb = RGBColor(40, 56, 85)
        ptf = pill.text_frame
        pp1 = ptf.paragraphs[0]
        pp1.text = stat
        pp1.font.size = Pt(20)
        pp1.font.bold = True
        pp1.font.color.rgb = TEXT_WHITE
        pp1.alignment = PP_ALIGN.CENTER
        pp2 = ptf.add_paragraph()
        pp2.text = label
        pp2.font.size = Pt(10)
        pp2.font.color.rgb = TEXT_MUTED
        pp2.alignment = PP_ALIGN.CENTER

    s1.notes_slide.notes_text_frame.text = (
        "Good morning everyone. I'm presenting Vouch, the human-first email safety network. "
        "We solve the biggest vulnerability in cybersecurity today: the gap between enterprise security tools and human understanding."
    )

    # ==========================================
    # SLIDE 2: THE PROBLEM
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    add_bg(s2)
    add_header(s2, "Market Reality & The Core Dilemma", "Email Security Is Broken for Everyday Humans", "Traditional tools bombard users with terror or leave them completely exposed")

    # Left Card: Traditional Security Flaws
    c_left = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.9), Inches(5.6), Inches(4.9))
    c_left.fill.solid()
    c_left.fill.fore_color.rgb = CARD_BG
    c_left.line.color.rgb = RGBColor(120, 40, 40)
    c_left.line.width = Pt(1.5)
    tfl = c_left.text_frame
    tfl.word_wrap = True
    pl1 = tfl.paragraphs[0]
    pl1.text = "❌ TRADITIONAL APPROACH"
    pl1.font.size = Pt(14)
    pl1.font.bold = True
    pl1.font.color.rgb = ACCENT_CORAL

    points_left = [
        ("Cryptic IT Jargon:", "Banners like 'SPF/DKIM alignment failed' mean nothing to a non-technical user."),
        ("Panic-Inducing Red Alerts:", "Users suffer from severe 'warning fatigue' and bypass alerts reflexively."),
        ("Static & Binary:", "Either blocks outright (killing legitimate business) or passes scams straight into inbox."),
        ("No Collective Memory:", "When an employee gets phished, zero protection carries over to the next victim.")
    ]
    for title, desc in points_left:
        p = tfl.add_paragraph()
        p.text = f"• {title} {desc}"
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED

    # Right Card: The Massive Human Cost
    c_right = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(1.9), Inches(5.6), Inches(4.9))
    c_right.fill.solid()
    c_right.fill.fore_color.rgb = CARD_BG
    c_right.line.color.rgb = RGBColor(40, 60, 95)
    c_right.line.width = Pt(1.5)
    tfr = c_right.text_frame
    tfr.word_wrap = True
    pr1 = tfr.paragraphs[0]
    pr1.text = "📊 THE REALITY BY NUMBERS"
    pr1.font.size = Pt(14)
    pr1.font.bold = True
    pr1.font.color.rgb = ACCENT_INDIGO

    stats_right = [
        ("91% of Cyberattacks", "Begin with a spear-phishing email targeting human emotions."),
        ("3.4 Billion Fake Emails", "Are launched worldwide every day by automated phishing kits."),
        ("\$4.9 Million Average Breach Cost", "For small-to-medium businesses hit by account takeovers."),
        ("82% of Breaches Involve Humans", "The problem isn't broken firewalls; it's misunderstood emails.")
    ]
    for stat, sub in stats_right:
        p = tfr.add_paragraph()
        p.text = f"• {stat}: {sub}"
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED

    s2.notes_slide.notes_text_frame.text = (
        "Traditional email security fails because it treats people like IT admins. "
        "A red warning that screams 'DMARC Fail' doesn't help anyone—it causes panic or gets ignored. "
        "Over 90% of breaches happen because users don't know who to trust."
    )

    # ==========================================
    # SLIDE 3: THE SOLUTION
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    add_bg(s3)
    add_header(s3, "Introducing Vouch", "The Intelligent, Calm Email Companion", "Translating invisible attack vectors into 2-sentence conversational clarity")

    sol_cards = [
        ("1. Conversational AI Insights", "Translates hidden technical threats into calm, friend-to-friend explanations in under 60 words. No panic. No jargon.", ACCENT_EMERALD),
        ("2. Multi-Layer Threat Engine", "Real-time Google Safe Browsing, ICANN RDAP domain registration age, brand impersonation & spoofed link inspection.", ACCENT_INDIGO),
        ("3. Collective Community Shield", "When one user catches or vouches for an email, privacy-preserving SHA-256 hashes shield the entire community.", ACCENT_AMBER)
    ]
    for i, (heading, desc, color) in enumerate(sol_cards):
        cx = Inches(0.8 + i * 4.0)
        c = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, cx, Inches(2.0), Inches(3.7), Inches(4.7))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = color
        c.line.width = Pt(1.5)
        tf = c.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = heading
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = color

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_MUTED

        p3 = tf.add_paragraph()
        p3.text = "\n✨ User Benefit:"
        p3.font.size = Pt(12)
        p3.font.bold = True
        p3.font.color.rgb = TEXT_WHITE

        sub_desc = [
            "Clear understanding before taking action.",
            "Deep forensic defense working silently.",
            "Crowdsourced immunity against zero-day campaigns."
        ][i]
        p4 = tf.add_paragraph()
        p4.text = sub_desc
        p4.font.size = Pt(12)
        p4.font.color.rgb = TEXT_MUTED

    s3.notes_slide.notes_text_frame.text = (
        "Vouch replaces the red panic banner with a calm, conversational explanation. "
        "It acts like a knowledgeable cybersecurity friend sitting next to you, looking over the email and explaining what's happening."
    )

    # ==========================================
    # SLIDE 4: THE 6-LAYER ARCHITECTURE
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    add_bg(s4)
    add_header(s4, "Deep Technical Defense", "6-Layer Intelligent Threat Engine", "Automated forensic inspection running in milliseconds on every incoming message")

    layers = [
        ("Layer 1: Brand Impersonation", "Detects display-name spoofing (e.g., 'PayPal Support' from a mailer-alert domain)."),
        ("Layer 2: Google Safe Browsing API", "Direct real-time lookup against Google's global malware and phishing database."),
        ("Layer 3: ICANN RDAP Domain Age", "Official registry protocol query: flags domains registered <30 days ago (NRD)."),
        ("Layer 4: Spoofed Link Inspector", "Compares visible anchor text against actual destination domains and bare IP URLs."),
        ("Layer 5: Reply-To Redirection", "Detects silent redirection tricks pointing user replies to external attacker inboxes."),
        ("Layer 6: Conversational LLM Synthesizer", "Generates concise, human-grade explanations with OpenAI gpt-4o-mini & heuristics.")
    ]

    for i, (title, desc) in enumerate(layers):
        col = i % 2
        row = i // 2
        x = Inches(0.8 + col * 5.9)
        y = Inches(1.9 + row * 1.6)

        c = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(1.35))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)

        tf = c.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = f"🛡️ {title}"
        p1.font.size = Pt(13)
        p1.font.bold = True
        p1.font.color.rgb = ACCENT_EMERALD

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(11)
        p2.font.color.rgb = TEXT_MUTED

    s4.notes_slide.notes_text_frame.text = (
        "Under the hood, Vouch is rigorous. Every email passes through 6 automated forensic layers: "
        "brand impersonation, Google Safe Browsing, ICANN RDAP domain registration age, link analysis, reply-to checks, and LLM synthesis."
    )

    # ==========================================
    # SLIDE 5: THE SECRET WEAPON: "TRUST, BUT VERIFY"
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    add_bg(s5)
    add_header(s5, "Zero-Trust Innovation", "The 'Trust, But Verify' Defense Matrix", "Honoring user vouches without compromising on hard forensic attack signals")

    # Left Box: Soft Warnings Can Be Vouched
    b1 = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(2.0), Inches(5.6), Inches(4.7))
    b1.fill.solid()
    b1.fill.fore_color.rgb = CARD_BG
    b1.line.color.rgb = ACCENT_EMERALD
    b1.line.width = Pt(1.5)
    tf1 = b1.text_frame
    tf1.word_wrap = True
    p1 = tf1.paragraphs[0]
    p1.text = "✅ USER TRUST (SOFT SIGNALS)"
    p1.font.size = Pt(15)
    p1.font.bold = True
    p1.font.color.rgb = ACCENT_EMERALD

    items1 = [
        ("Recurring Newsletters & Invoices:", "When a user vouches for a known vendor, repetitive urgency warnings are silenced."),
        ("No Warning Fatigue:", "Inbox stays calm and green. Users aren't nagged by repetitive false alarms."),
        ("Sender Address Strictness:", "Trust is anchored to the EXACT sender address and thread, not whole generic domains.")
    ]
    for t, d in items1:
        p = tf1.add_paragraph()
        p.text = f"• {t} {d}"
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED

    # Right Box: Hard Signals Can NEVER Be Silenced
    b2 = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(2.0), Inches(5.6), Inches(4.7))
    b2.fill.solid()
    b2.fill.fore_color.rgb = CARD_BG
    b2.line.color.rgb = ACCENT_CORAL
    b2.line.width = Pt(1.5)
    tf2 = b2.text_frame
    tf2.word_wrap = True
    p2 = tf2.paragraphs[0]
    p2.text = "🚨 UNCOMPROMISING HARD SIGNALS"
    p2.font.size = Pt(15)
    p2.font.bold = True
    p2.font.color.rgb = ACCENT_CORAL

    items2 = [
        ("Google Safe Browsing Hits:", "If a link is weaponized with malware, user vouch is immediately overridden."),
        ("Brand Impersonation & Spoofed Links:", "If an attacker forges a trusted brand's anchor text, Vouch alerts instantly."),
        ("Disposable Domains (<7 Days Old):", "Disposable infrastructure automatically triggers risk alerts regardless of prior vouches.")
    ]
    for t, d in items2:
        p = tf2.add_paragraph()
        p.text = f"• {t} {d}"
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_MUTED

    s5.notes_slide.notes_text_frame.text = (
        "Our golden security innovation is 'Trust, but Verify'. "
        "If you vouch for an email, we remember your preference so you aren't annoyed. "
        "BUT if that sender account gets hijacked or adds a disguised malicious link, Vouch detects the hard signal and warns you anyway."
    )

    # ==========================================
    # SLIDE 6: COLLECTIVE COMMUNITY IMMUNITY
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    add_bg(s6)
    add_header(s6, "Decentralized Crowdsourcing", "Collective Immunity Network", "Protecting thousands of inboxes the second one user flags an attack")

    steps = [
        ("Step 1: Local Flagging", "A user in London flags a spear-phishing email claiming to be an invoice.", ACCENT_INDIGO),
        ("Step 2: Privacy Hash Generation", "Vouch creates a 24-char SHA-256 fingerprint: SHA(Domain + CleanSubject). Zero email text stored.", ACCENT_EMERALD),
        ("Step 3: Instant Community Shield", "When a user in New York receives the same campaign 5 minutes later, Vouch warns: 'Flagged by 42 members'.", ACCENT_AMBER)
    ]
    for i, (stitle, sdesc, scolor) in enumerate(steps):
        cx = Inches(0.8 + i * 4.0)
        c = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, cx, Inches(2.1), Inches(3.7), Inches(4.5))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = scolor
        c.line.width = Pt(1.5)

        tf = c.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = stitle
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = scolor

        p2 = tf.add_paragraph()
        p2.text = f"\n{sdesc}"
        p2.font.size = Pt(13)
        p2.font.color.rgb = TEXT_MUTED

    s6.notes_slide.notes_text_frame.text = (
        "Phishing attacks are distributed, so defense must be collaborative. "
        "With privacy-preserving SHA-256 fingerprinting, zero private data is shared, "
        "yet every user benefits from the collective intelligence of the entire network."
    )

    # ==========================================
    # SLIDE 7: LIVE PRODUCT DEMO
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    add_bg(s7)
    add_header(s7, "Production Walkthrough", "Live Product Experience", "Production deployed on Render + Neon Cloud Postgres")

    demo_box = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(2.0), Inches(10.33), Inches(4.8))
    demo_box.fill.solid()
    demo_box.fill.fore_color.rgb = CARD_BG
    demo_box.line.color.rgb = ACCENT_INDIGO
    demo_box.line.width = Pt(1.5)

    tf = demo_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "💻 LIVE WEB APPLICATION ARCHITECTURE"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.alignment = PP_ALIGN.CENTER

    points = [
        "• Production Deployment: Live on Render (email-guardian-backend.onrender.com)",
        "• Resilient Dual-Engine DB: Neon Cloud Serverless PostgreSQL with SQLite test fallback",
        "• Secure Gmail OAuth2: Strictly read-only gmail.readonly scopes with AES-256-GCM token encryption",
        "• Real-Time Threat Rendering: Instant expand/collapse UI with custom Tailwind CSS styling",
        "• Zero Stored XSS: Contextual tokenized rendering preventing script injections"
    ]
    for pt in points:
        pp = tf.add_paragraph()
        pp.text = pt
        pp.font.size = Pt(13)
        pp.font.color.rgb = TEXT_MUTED

    s7.notes_slide.notes_text_frame.text = (
        "Now I'd like to switch over to the live application. "
        "As you see on screen, the interface is calm and responsive. Let's look at this PayPal alert..."
    )

    # ==========================================
    # SLIDE 8: MARKET OPPORTUNITY & TARGET AUDIENCE
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    add_bg(s8)
    add_header(s8, "Business Viability", "Market Opportunity & Target Segment", "Capturing the massive underserved market between consumer spam filters and enterprise SOCs")

    m_cards = [
        ("\$5.5 Billion", "Global Email Security Market (CAGR 11.2%)", ACCENT_INDIGO),
        ("33 Million", "Small & Medium Businesses in the US alone with zero IT security staff", ACCENT_EMERALD),
        ("4.3 Billion", "Active email users globally seeking personal inbox safety", ACCENT_AMBER)
    ]
    for i, (stat, desc, color) in enumerate(m_cards):
        cx = Inches(0.8 + i * 4.0)
        c = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, cx, Inches(2.1), Inches(3.7), Inches(4.5))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = color
        c.line.width = Pt(1.5)

        tf = c.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = stat
        p1.font.size = Pt(28)
        p1.font.bold = True
        p1.font.color.rgb = color

        p2 = tf.add_paragraph()
        p2.text = f"\n{desc}"
        p2.font.size = Pt(14)
        p2.font.color.rgb = TEXT_WHITE

    s8.notes_slide.notes_text_frame.text = (
        "The email security market is over 5 billion dollars. "
        "Enterprise solutions charge tens of thousands of dollars, while everyday consumers and small businesses are left completely unprotected. "
        "That's our beachhead."
    )

    # ==========================================
    # SLIDE 9: BUSINESS MODEL & GO-TO-MARKET
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    add_bg(s9)
    add_header(s9, "Monetization Strategy", "Business Model & Revenue Streams", "High-margin SaaS with viral community loop")

    tiers = [
        ("Free Community", "Free Forever", [
            "Single personal Gmail account",
            "Core 6-layer threat scanning",
            "Community consensus voting",
            "Standard conversational explanations"
        ], ACCENT_INDIGO),
        ("Vouch Pro", "\$4.99 / month", [
            "Multiple accounts (Work + Personal)",
            "Priority LLM threat deep-dives",
            "Link sandbox pre-inspection",
            "Family protection (up to 5 seats)"
        ], ACCENT_EMERALD),
        ("Vouch for Teams", "\$8 / seat / month", [
            "Company-wide collective immunity",
            "Executive impersonation protection",
            "Compliance export & reporting",
            "Central admin security dashboard"
        ], ACCENT_AMBER)
    ]
    for i, (name, price, features, color) in enumerate(tiers):
        cx = Inches(0.8 + i * 4.0)
        c = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, cx, Inches(2.1), Inches(3.7), Inches(4.6))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = color
        c.line.width = Pt(1.5)

        tf = c.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = name
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = color

        p2 = tf.add_paragraph()
        p2.text = price
        p2.font.size = Pt(18)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_WHITE

        for feat in features:
            pf = tf.add_paragraph()
            pf.text = f"✓ {feat}"
            pf.font.size = Pt(11)
            pf.font.color.rgb = TEXT_MUTED

    s9.notes_slide.notes_text_frame.text = (
        "We operate a classic freemium SaaS model. "
        "The free tier drives the viral collective immunity network, "
        "while SMBs and power users upgrade to Vouch Pro and Teams for multi-account and corporate protection."
    )

    # ==========================================
    # SLIDE 10: THE ASK & VISION
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    add_bg(s10)
    add_header(s10, "The Next Chapter", "The Vision & The Ask", "Join us in redefining human-centered cybersecurity")

    box_ask = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(2.0), Inches(10.33), Inches(4.7))
    box_ask.fill.solid()
    box_ask.fill.fore_color.rgb = CARD_BG
    box_ask.line.color.rgb = ACCENT_EMERALD
    box_ask.line.width = Pt(1.5)

    tfa = box_ask.text_frame
    tfa.word_wrap = True
    pa = tfa.paragraphs[0]
    pa.text = "🎯 OUR 12-MONTH MILESTONES & SEED ROUND"
    pa.font.size = Pt(18)
    pa.font.bold = True
    pa.font.color.rgb = ACCENT_EMERALD
    pa.alignment = PP_ALIGN.CENTER

    ask_points = [
        ("Platform Expansion:", "Release Outlook / Microsoft 365 and Apple Mail extensions."),
        ("Crowdsourced Threat Graph:", "Scale the collective fingerprinting engine to 100,000 active nodes."),
        ("Enterprise Pilot Program:", "Onboard 50 beta SMB teams into Vouch for Teams."),
        ("The Ask:", "Seeking \$750,000 in Seed Funding / Strategic Mentorship to accelerate GTM and team expansion.")
    ]
    for title, desc in ask_points:
        p = tfa.add_paragraph()
        p.text = f"\n• {title} {desc}"
        p.font.size = Pt(13)
        p.font.color.rgb = TEXT_MUTED

    s10.notes_slide.notes_text_frame.text = (
        "We are raising 750k in seed funding to expand onto Microsoft Outlook and Apple Mail, "
        "scale our collective immunity network, and launch Vouch for Teams. "
        "Thank you, and I look forward to your questions."
    )

    # Output directory
    output_path = os.path.abspath("Vouch_Pitch_Deck.pptx")
    prs.save(output_path)
    print(f"Presentation successfully saved to: {output_path}")

if __name__ == "__main__":
    create_deck()
