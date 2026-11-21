import React, { useState, useEffect } from 'react';
import { CheckCircle2, ShieldAlert, Sparkles, Inbox, ShieldCheck } from 'lucide-react';
import Topbar from './components/Topbar';
import ConnectBanner from './components/ConnectBanner';
import EmailRow from './components/EmailRow';

export default function App() {
  const [emails, setEmails] = useState([]);
  const [openIds, setOpenIds] = useState(new Set());
  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'needs_review' | 'safe'

  // Check URL params for OAuth return or error
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connectedParam = urlParams.get('connected');
    const userEmail = urlParams.get('user');
    const authError = urlParams.get('auth_error');

    if (authError) {
      const friendly =
        authError === 'missing_gmail_scope'
          ? 'Vouch needs permission to read your emails. Please click "Connect Gmail" again and tick the "View your email messages" box.'
          : authError === 'access_denied'
            ? 'Gmail connection was cancelled.'
            : `Google sign-in error: ${authError}`;
      showToast(friendly, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (connectedParam === 'true' && userEmail) {
      localStorage.setItem('vouch_user', userEmail);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    checkAuthAndLoad();
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const checkAuthAndLoad = async () => {
    setLoading(true);
    const storedUser = localStorage.getItem('vouch_user');

    try {
      // 1. Check Auth Status with Backend
      const authRes = await fetch(`/api/auth/status${storedUser ? `?user=${encodeURIComponent(storedUser)}` : ''}`);
      const authData = await authRes.json();

      setOauthConfigured(authData.oauthConfigured);
      setConnected(authData.connected);
      setUser(authData.user);

      // 2. Fetch Emails (live if authenticated, otherwise demo)
      const userParam = authData.connected && authData.user?.email ? `?user=${encodeURIComponent(authData.user.email)}` : '?mode=demo';
      const emailRes = await fetch(`/api/emails${userParam}`);
      const emailData = await emailRes.json();

      let fetchedEmails = emailData.emails || [];
      // For real inboxes the server is the single source of truth: it re-verifies every
      // email even if the user vouched for it before. Local memory is only used for the demo inbox.
      if (emailData.isDemo) try {
        const storedActions = JSON.parse(localStorage.getItem('vouch_actions') || '{}');
        fetchedEmails = fetchedEmails.map(e => {
          const remembered = storedActions[e.id] || storedActions[e.messageId];
          if (remembered === 'safe' || e.actionTaken === 'safe') {
            return {
              ...e,
              actionTaken: 'safe',
              riskLevel: 'safe',
              riskScore: 0,
              reasons: ['Previously vouched as safe by you'],
              explanation: null
            };
          } else if (remembered === 'flag' || e.actionTaken === 'flag') {
            return {
              ...e,
              actionTaken: 'flag',
              riskLevel: 'risk'
            };
          }
          return e;
        });
      } catch {}

      setEmails(fetchedEmails);
      setIsDemo(emailData.isDemo);

      if (emailData.authExpired) {
        setConnected(false);
        setUser(null);
        localStorage.removeItem('vouch_user');
      }

      if (emailData.warning) {
        showToast(emailData.warning, 'info');
      }
    } catch (err) {
      console.error('Error loading Vouch state:', err);
      // Fallback fetch demo mode directly
      fetch('/api/emails?mode=demo')
        .then(res => res.json())
        .then(data => {
          let demoList = data.emails || [];
          try {
            const storedActions = JSON.parse(localStorage.getItem('vouch_actions') || '{}');
            demoList = demoList.map(e => {
              const remembered = storedActions[e.id] || storedActions[e.messageId];
              if (remembered === 'safe' || e.actionTaken === 'safe') {
                return {
                  ...e,
                  actionTaken: 'safe',
                  riskLevel: 'safe',
                  riskScore: 0,
                  reasons: ['Previously vouched as safe by you'],
                  explanation: null
                };
              }
              return e;
            });
          } catch {}
          setEmails(demoList);
          setIsDemo(true);
        })
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRow = (id) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAction = async (id, action) => {
    const isSafeAction = action === 'safe' || action === 'vouch';
    const actionKey = isSafeAction ? 'safe' : 'flag';

    // Immediately update UI optimistically
    setEmails(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              actionTaken: actionKey,
              riskLevel: isSafeAction ? 'safe' : 'risk',
              riskScore: isSafeAction ? 0 : e.riskScore,
              reasons: isSafeAction ? ['Previously vouched as safe by you'] : e.reasons,
              explanation: isSafeAction ? null : e.explanation
            }
          : e
      )
    );
    if (isSafeAction) {
      setOpenIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }

    // Persist vouch action locally so any future refreshes or matching emails recall it immediately
    try {
      const storedActions = JSON.parse(localStorage.getItem('vouch_actions') || '{}');
      storedActions[id] = actionKey;
      localStorage.setItem('vouch_actions', JSON.stringify(storedActions));
    } catch {}

    try {
      const res = await fetch(`/api/emails/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionKey, userEmail: user?.email })
      });
      const data = await res.json();
      showToast(data.message || (isSafeAction ? 'Vouched as safe' : 'Flagged as scam'));
    } catch {
      showToast(isSafeAction ? 'Vouched as safe' : 'Flagged as scam');
    }
  };

  const handleDisconnect = async () => {
    if (user?.email) {
      await fetch('/api/auth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user.email })
      });
    }
    localStorage.removeItem('vouch_user');
    setUser(null);
    setConnected(false);
    setEmails([]);
    showToast('Gmail account disconnected.');
    checkAuthAndLoad();
  };

  const handleToggleDemo = () => {
    if (isDemo && connected) {
      checkAuthAndLoad();
    } else {
      fetch('/api/emails?mode=demo')
        .then(res => res.json())
        .then(data => {
          setEmails(data.emails || []);
          setIsDemo(true);
          showToast('Loaded demo inbox sample');
        });
    }
  };

  // Compute live threat counts and inbox health score
  const needsReviewCount = emails.filter(e => {
    const isVouched = e.actionTaken === 'safe' || e.actionTaken === 'vouch';
    const effectiveRisk = isVouched ? 'safe' : e.riskLevel;
    return !isVouched && (effectiveRisk === 'caution' || effectiveRisk === 'risk');
  }).length;

  const safeCount = emails.filter(e => {
    const isVouched = e.actionTaken === 'safe' || e.actionTaken === 'vouch';
    const effectiveRisk = isVouched ? 'safe' : e.riskLevel;
    return isVouched || effectiveRisk === 'safe';
  }).length;

  const vouchedByUserCount = emails.filter(e => e.actionTaken === 'safe' || e.actionTaken === 'vouch').length;

  const totalCount = emails.length;
  const healthScore = totalCount > 0 ? Math.round((safeCount / totalCount) * 100) : 100;

  // Filter emails based on active pill
  const displayedEmails = emails.filter(e => {
    const isVouched = e.actionTaken === 'safe' || e.actionTaken === 'vouch';
    const effectiveRisk = isVouched ? 'safe' : e.riskLevel;
    const isThreat = !isVouched && (effectiveRisk === 'caution' || effectiveRisk === 'risk');

    if (activeFilter === 'needs_review') return isThreat;
    if (activeFilter === 'safe') return !isThreat;
    return true;
  });

  return (
    <div className="max-w-[760px] mx-auto py-9 px-5 pb-[90px]">
      {/* Top Header */}
      <Topbar />

      {/* Connection & Setup Banner */}
      <ConnectBanner
        user={user}
        connected={connected}
        oauthConfigured={oauthConfigured}
        isDemo={isDemo}
        loading={loading}
        onRefresh={checkAuthAndLoad}
        onDisconnect={handleDisconnect}
        onToggleDemo={handleToggleDemo}
      />

      {/* Inbox Controls Bar: Filter Switcher & Health Gauge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 px-0.5">
        {/* Filter Pills */}
        <div className="inline-flex items-center gap-1 bg-paper-raised p-1 rounded-lg border border-line text-[12.5px] font-medium shadow-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-teal-deep text-white font-semibold shadow-xs'
                : 'text-ink-soft hover:text-ink hover:bg-line-soft'
            }`}
          >
            All <span className="opacity-75 tabular-nums text-[11px]">({totalCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('needs_review')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeFilter === 'needs_review'
                ? 'bg-teal-deep text-white font-semibold shadow-xs'
                : 'text-ink-soft hover:text-ink hover:bg-line-soft'
            }`}
          >
            {needsReviewCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></span>
            )}
            Needs Review
            <span className={`tabular-nums text-[11px] px-1.5 py-0.5 rounded-full ${
              needsReviewCount > 0
                ? activeFilter === 'needs_review' ? 'bg-white/20 text-white font-bold' : 'bg-gold-bg text-gold-text font-bold'
                : 'opacity-70'
            }`}>
              {needsReviewCount}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('safe')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'safe'
                ? 'bg-teal-deep text-white font-semibold shadow-xs'
                : 'text-ink-soft hover:text-ink hover:bg-line-soft'
            }`}
          >
            Safe <span className="opacity-75 tabular-nums text-[11px]">({safeCount})</span>
            {vouchedByUserCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                activeFilter === 'safe' ? 'bg-white/20 text-white' : 'bg-safe-bg text-safe border border-[#D1E2D6]'
              }`}>
                {vouchedByUserCount} vouched
              </span>
            )}
          </button>
        </div>

        {/* Inbox Health Score Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-safe-bg text-safe border border-[#D1E2D6] text-[12px] font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7FA085] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7FA085]"></span>
            </span>
            <span>Inbox Health: {healthScore}% Calm</span>
          </div>
        </div>
      </div>

      {/* Inbox Rows List */}
      <div className="flex flex-col gap-[9px]">
        {loading && emails.length === 0 ? (
          <div className="bg-paper-raised border border-line rounded-lg-custom p-8 text-center text-ink-soft text-[14px]">
            Scanning inbox for recent emails and analyzing threat signatures...
          </div>
        ) : displayedEmails.length === 0 ? (
          activeFilter === 'needs_review' ? (
            <div className="bg-paper-raised border border-line rounded-lg-custom p-8 text-center flex flex-col items-center justify-center gap-2 shadow-rest">
              <div className="w-10 h-10 rounded-full bg-safe-bg text-safe flex items-center justify-center mb-1">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="font-semibold text-ink text-[15px]">Inbox is calm & protected</div>
              <p className="text-ink-faint text-[13px] max-w-sm m-0">
                No active threats or unreviewed emails requiring your attention right now.
              </p>
            </div>
          ) : (
            <div className="bg-paper-raised border border-line rounded-lg-custom p-8 text-center text-ink-faint text-[14px]">
              No emails found in this view.
            </div>
          )
        ) : (
          displayedEmails.map(email => (
            <EmailRow
              key={email.id}
              email={email}
              isOpen={openIds.has(email.id)}
              onToggle={handleToggleRow}
              onAction={handleAction}
            />
          ))
        )}
      </div>

      {/* Privacy Disclosure & Philosophy Footer */}
      <p className="text-center text-[12.5px] text-ink-faint mt-7 leading-[1.7] px-5">
        <strong className="text-ink-soft font-semibold">Vouch</strong> scans quietly in the background — nothing to forward, convert, or upload. When one person flags a scam, everyone using Vouch is protected from it within seconds.
      </p>

      {/* Toast Feedback Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-ink text-paper-raised px-4 py-2.5 rounded-lg text-[13px] font-medium shadow-lg animate-fade-in z-50 flex items-center gap-2">
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

