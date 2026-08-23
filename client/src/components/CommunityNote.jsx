import React from 'react';

export default function CommunityNote({ count = 212 }) {
  if (!count || count <= 0) return null;

  return (
    <div className="mt-[13px] flex items-center gap-[9px] bg-violet-bg text-violet-deep text-[12.5px] font-medium py-[10px] px-[13px] rounded-[11px] border border-violet/15">
      <svg className="w-[15px] h-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2 4 5v6c0 5.2 3.4 9.6 8 11 4.6-1.4 8-5.8 8-11V5l-8-3Z" />
      </svg>
      <span>
        <strong>{count.toLocaleString()}</strong> {count === 1 ? 'other person' : 'other people'} got this exact email today — you're not the only one it's targeting.
      </span>
    </div>
  );
}

