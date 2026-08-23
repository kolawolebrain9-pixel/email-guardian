# 🛡️ Vouch — Passive Email Safety Tool

> **Someone's got your inbox.** A calm, reassuring email safety tool that scans your Gmail inbox in the background (read-only) and displays risk-assessed badges, friend-toned explanations, and community scam counts without requiring you to forward, upload, or convert anything.

---

## ✨ Features

- **Passive & Frictionless**: Connects to Gmail with **strictly read-only access** (`https://www.googleapis.com/auth/gmail.readonly`).
- **Clear, Non-Alarming Badges**:
  - 🟢 **Green dot**: Safe, verified sender and authentic links.
  - 🟡 **Pulsing amber dot**: *Worth a second look* (minor domain mismatch or unexpected redirects).
  - 🔴 **Pulsing coral dot**: *Looks like a scam* (brand impersonation, spoofed links, or credential urgency lures).
- **Friend-Toned Explanation Cards**: Expands into a warm, conversational explanation (<60 words) written like a knowledgeable friend, backed by 2–3 concrete technical bullet points with domain and code snippets.
- **Privacy-Preserving Community Fingerprints**: Hashes the sender domain + normalized subject line with SHA-256 (never storing email bodies) to track how many other users received the same scam today ("*212 other people got this exact email today*").
- **Live Vouch Counter**: Global header counter tracking total emails vouched for today across all users.
- **Built-in Demo & Offline Mode**: Explore the full UI, explanations, and community notes immediately with realistic sample emails, even before configuring Google Cloud credentials.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v20/v24)
- **npm**: v9+

### 2. Install Dependencies
```powershell
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install --legacy-peer-deps
cd ..
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```

### 4. Run Server and Client
In two terminal windows:

**Terminal 1 (Backend API - Port 3001):**
```powershell
cd server
npm run dev
```

**Terminal 2 (Frontend React App - Port 5173):**
```powershell
cd client
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser!

---

## 🔑 Google Cloud OAuth Setup (Testing Mode)

Vouch only requires the **read-only** Gmail scope (`https://www.googleapis.com/auth/gmail.readonly`). In Google Cloud **"Testing"** status, no verification or security review is required for local testing.

### Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top and select **New Project**.
3. Name it **Vouch Local Dev** and click **Create**.

### Step 2: Enable the Gmail API
1. In the left sidebar, navigate to **APIs & Services** → **Library**.
2. Search for **Gmail API**.
3. Click on **Gmail API** and click **Enable**.

### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**.
2. Select User Type: **External** (or Internal if using Google Workspace), then click **Create**.
3. Fill in:
   - **App name**: `Vouch`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. On the **Scopes** page:
   - Click **Add or Remove Scopes**.
   - Search for `https://www.googleapis.com/auth/gmail.readonly` and check it.
   - Click **Update** and **Save and Continue**.
6. On the **Test users** page:
   - Click **Add Users**.
   - Enter your Gmail address (and any tester emails you want to test with).
   - Click **Add**, then **Save and Continue**.
7. Keep the Publishing Status as **Testing**.

### Step 4: Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Vouch Local Web Client`.
5. Under **Authorized redirect URIs**, click **Add URI** and enter:
   ```
   http://localhost:3001/api/auth/callback
   ```
6. Click **Create**.
7. Copy your **Client ID** and **Client Secret** into your `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/callback
   ```

### Step 5: Restart the Server
Restart `npm run dev` in the `server` directory. Refresh `http://localhost:5173` and click **Connect Gmail**!

---

## 🧪 Running Automated Tests

Run backend unit and integration tests:
```powershell
cd server
npm test
```
Tests verify:
- AES-256-GCM token encryption and decryption.
- Threat Engine classification for brand impersonation, spoofed URLs, and panic keywords.
- Community SHA-256 fingerprint normalization and deduplication.

---

## 📁 Architecture Overview

```
email-guardian/
├── client/                     # React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── Topbar.jsx      # Brand mark + live vouched counter
│   │   │   ├── ConnectBanner.jsx # Google OAuth status & demo toggle
│   │   │   ├── EmailRow.jsx    # Pulsing indicator & expandable card
│   │   │   ├── ExplanationCard.jsx # Conversational speech bubble & reasons
│   │   │   └── CommunityNote.jsx # Violet community threat frequency note
│   │   ├── App.jsx             # Main inbox state & toast alerts
│   │   └── index.css           # Custom paper/teal styling & animations
│   └── tailwind.config.js      # Color tokens matching reference mockup
│
├── server/                     # Node.js + Express + Native SQLite
│   ├── src/
│   │   ├── db/database.js      # SQLite schema for users, tokens, scans, fingerprints
│   │   ├── services/
│   │   │   ├── googleAuth.js   # OAuth flow & AES-256 token encryption
│   │   │   ├── gmailService.js # Read-only Gmail API client
│   │   │   ├── threatEngine.js # Phishing heuristic scanner & threat intel stub
│   │   │   ├── explanationService.js # LLM / template friendly explanation generator
│   │   │   └── communityService.js # SHA-256 fingerprinting & community counter
│   │   ├── routes/
│   │   │   ├── authRoutes.js   # OAuth endpoints
│   │   │   ├── emailRoutes.js  # Live scan & action endpoints
│   │   │   └── statsRoutes.js  # Global vouched statistics
│   │   └── server.js           # Express app setup
│   └── tests/vouch.test.js     # Test suite
│
├── .env.example                # Configuration template
└── README.md                   # Setup guide
```

---

## 🔒 Privacy & Security

- **Strictly Read-Only**: Vouch cannot send emails, delete messages, or alter user accounts.
- **AES-256-GCM Encryption**: OAuth tokens are encrypted at rest using industry-standard authenticated encryption.
- **Privacy-Preserving Fingerprints**: Community notes never store email body content; they compute `SHA-256(sender_domain + ":" + normalized_subject)` to aggregate attack patterns without exposing personal messages.

