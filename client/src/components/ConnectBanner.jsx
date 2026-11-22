import React from 'react';
import { ShieldCheck, RefreshCw, LogOut, Sparkles, CheckCircle2 } from 'lucide-react';

export default function ConnectBanner({
  user,
  connected,
  oauthConfigured,
  isDemo,
  loading,
  onRefresh,
  onDisconnect,
  onToggleDemo
}) {
  const handleConnectGmail = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="bg-paper-raised border border-line rounded-lg-custom p-3.5 sm:p-4 mb-4 sm:mb-5 shadow-rest flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${connected ? 'bg-safe-bg text-safe' : 'bg-teal-tint text-teal-deep'}`}>
          {connected ? <ShieldCheck className="w-5 h-5" /> : <Sparkles className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink flex flex-wrap items-center gap-1.5 min-w-0">
            {connected ? (
              <>
                <span className="truncate max-w-[190px] xs:max-w-[280px] sm:max-w-none">Connected to Gmail: <strong>{user?.email || 'Active Account'}</strong></span>
                <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-medium bg-safe-bg text-safe px-2 py-0.5 rounded-full flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Read-Only
                </span>
              </>
            ) : (
              <span className="leading-snug">Sample Inbox Preview — Connect Gmail to scan yours</span>
            )}
          </div>
          <p className="text-ink-faint text-[11.5px] sm:text-[12px] m-0 mt-0.5 leading-tight sm:leading-normal">
            {connected
              ? "Scanning your recent emails quietly in the background."
              : "Read-only access — Vouch never deletes, sends, or modifies your emails."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start flex-shrink-0 pt-1 sm:pt-0">
        {connected ? (
          <>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-[12px] font-semibold rounded-md-custom border border-line bg-paper text-ink hover:bg-line-soft active:scale-[0.98] transition cursor-pointer"
              title="Rescan recent emails"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Scanning...' : 'Rescan'}</span>
            </button>
            <button
              onClick={onDisconnect}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-2 sm:py-1.5 text-[12px] font-medium rounded-md-custom text-ink-soft hover:text-coral hover:bg-coral-bg active:scale-[0.98] transition cursor-pointer"
              title="Disconnect account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {oauthConfigured ? (
              <button
                onClick={handleConnectGmail}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-teal text-white font-semibold px-4 py-2.5 sm:py-2 rounded-md-custom hover:bg-teal-deep active:scale-95 transition shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Connect Gmail
              </button>
            ) : (
              <span className="text-[11.5px] text-ink-faint italic">
                (Google OAuth credentials not configured in .env)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

