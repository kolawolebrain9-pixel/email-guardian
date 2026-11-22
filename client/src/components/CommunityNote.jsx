import React from 'react';

export default function CommunityNote({ count = 0, communityStatus = 'none', vouchedCount = 0, flaggedCount = 0 }) {
  // 1. If other community members vouched this email as safe
  if (communityStatus === 'vouched' || vouchedCount > 0) {
    const total = vouchedCount || 1;
    return (
      <div className="mt-[10px] sm:mt-[13px] flex items-center gap-2 sm:gap-[9px] bg-safe-bg text-safe text-[11.5px] sm:text-[12.5px] font-medium py-2 sm:py-[10px] px-2.5 sm:px-[13px] rounded-[9px] sm:rounded-[11px] border border-safe/25 shadow-sm leading-snug">
        <svg className="w-[14px] h-[14px] sm:w-[15px] sm:h-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          <strong>{total}</strong> {total === 1 ? 'other member' : 'other members'} in the community vouched for this email as safe.
        </span>
      </div>
    );
  }

  // 2. If community members flagged this email as a scam
  if (communityStatus === 'flagged' || flaggedCount > 0) {
    const total = flaggedCount || 1;
    return (
      <div className="mt-[10px] sm:mt-[13px] flex items-center gap-2 sm:gap-[9px] bg-coral-bg text-coral-text text-[11.5px] sm:text-[12.5px] font-medium py-2 sm:py-[10px] px-2.5 sm:px-[13px] rounded-[9px] sm:rounded-[11px] border border-coral/25 shadow-sm leading-snug">
        <svg className="w-[14px] h-[14px] sm:w-[15px] sm:h-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        <span>
          <strong>{total}</strong> {total === 1 ? 'member' : 'members'} in the community flagged this email pattern as a scam.
        </span>
      </div>
    );
  }

  // 3. Neutral note: multiple users received it
  if (!count || count <= 0) return null;

  return (
    <div className="mt-[10px] sm:mt-[13px] flex items-center gap-2 sm:gap-[9px] bg-violet-bg text-violet-deep text-[11.5px] sm:text-[12.5px] font-medium py-2 sm:py-[10px] px-2.5 sm:px-[13px] rounded-[9px] sm:rounded-[11px] border border-violet/15 leading-snug">
      <svg className="w-[14px] h-[14px] sm:w-[15px] sm:h-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2 4 5v6c0 5.2 3.4 9.6 8 11 4.6-1.4 8-5.8 8-11V5l-8-3Z" />
      </svg>
      <span>
        <strong>{count.toLocaleString()}</strong> {count === 1 ? 'other person' : 'other people'} got this exact email today — you're not the only one it's targeting.
      </span>
    </div>
  );
}

