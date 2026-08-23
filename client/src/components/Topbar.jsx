import React, { useState, useEffect } from 'react';

export default function Topbar({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    // Fetch live global vouched count from API
    const fetchCount = () => {
      fetch('/api/stats')
        .then(res => res.json())
        .then(data => {
          if (typeof data.vouchedToday === 'number') setCount(data.vouchedToday);
        })
        .catch(() => {});
    };

    fetchCount();

    // Refresh the real count from the server periodically — no fake increments
    const interval = setInterval(fetchCount, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-between pb-6 mb-5 border-b border-line">
      {/* Brand */}
      <div className="flex items-center gap-[11px]">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-teal to-teal-deep flex items-center justify-center shadow-mark">
          <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none">
            <path d="M12 2 4 5v6c0 5.2 3.4 9.6 8 11 4.6-1.4 8-5.8 8-11V5l-8-3Z" fill="#fff" />
            <path d="M8.5 12.2l2.4 2.4 4.6-5.2" stroke="#1B3833" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex flex-col">
          <div className="font-serif text-[21px] font-semibold tracking-[-0.015em] text-ink leading-tight">
            Vouch
          </div>
          <div className="text-[11px] text-ink-faint font-medium mt-[1px] tracking-[0.01em] hidden sm:block">
            Someone's got your inbox
          </div>
        </div>
      </div>

      {/* Live Vouch Counter */}
      <div className="flex items-center gap-2 bg-violet-bg text-violet-deep py-2 px-[14px] pl-[11px] rounded-full text-[12.5px] font-semibold border border-violet/15 shadow-sm">
        <span className="relative flex h-[6px] w-[6px]">
          <span className="animate-ring absolute inline-flex h-full w-full rounded-full bg-violet opacity-75"></span>
          <span className="relative inline-flex rounded-full h-[6px] w-[6px] bg-violet"></span>
        </span>
        <span>{count.toLocaleString()} vouched for today</span>
      </div>
    </div>
  );
}