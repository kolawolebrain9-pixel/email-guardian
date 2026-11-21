import React from 'react';
import ExplanationCard from './ExplanationCard';
import CommunityNote from './CommunityNote';

export default function EmailRow({
  email,
  isOpen,
  onToggle,
  onAction
}) {
  const isVouchedSafe = email.actionTaken === 'safe' || email.actionTaken === 'vouch';
  const isFlagged = email.actionTaken === 'flag' || email.actionTaken === 'block';

  // If vouched safe by user, visually override to safe
  const effectiveRisk = isVouchedSafe ? 'safe' : email.riskLevel;
  const isExpandable = !isVouchedSafe && (effectiveRisk === 'caution' || effectiveRisk === 'risk');
  const isSafe = effectiveRisk === 'safe';
  const isCaution = !isVouchedSafe && !isFlagged && effectiveRisk === 'caution';
  const isRisk = isFlagged || (!isVouchedSafe && effectiveRisk === 'risk');

  const handleClick = (e) => {
    // Prevent toggle if clicking inside buttons or links
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    if (isExpandable) {
      onToggle(email.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-paper-raised border border-line rounded-lg-custom p-[15px_17px] flex items-start gap-[14px] shadow-rest transition-all duration-200 ${
        isExpandable
          ? 'cursor-pointer hover:shadow-hover hover:border-[#D3DBD6] hover:-translate-y-[1px]'
          : ''
      } ${isOpen ? 'shadow-hover border-[#D3DBD6]' : ''}`}
    >
      {/* Risk Badge Indicator */}
      <div
        className={`w-[20px] h-[20px] flex-shrink-0 mt-[2px] flex items-center justify-center relative ${
          isCaution ? 'text-gold' : isRisk ? 'text-coral' : 'text-safe'
        }`}
      >
        {/* Pulsing ring for caution / risk */}
        {(isCaution || isRisk) && (
          <span className="absolute inset-0 rounded-full border-[1.5px] border-current opacity-0 animate-pulsering pointer-events-none" />
        )}
        <div
          className={`w-[10px] h-[10px] rounded-full ${
            isSafe ? 'bg-[#7FA085]' : isCaution ? 'bg-gold' : 'bg-coral'
          }`}
        />
      </div>

      {/* Main Row Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-[10px]">
          <span className="font-semibold text-[14.5px] text-ink truncate tracking-[-0.005em]">
            {email.sender}
          </span>
          <span className="text-[12px] text-ink-faint flex-shrink-0 tabular-nums">
            {email.time}
          </span>
        </div>

        <div className="text-[13.5px] text-ink-soft mt-[3px] truncate">
          {email.subject}
        </div>

        {/* Vouched Safe / Flagged / Caution / Risk Tag */}
        {isVouchedSafe && (
          <div className="inline-flex items-center gap-[5px] text-[11px] font-semibold mt-[9px] py-[4px] px-[10px] rounded-full bg-safe-bg text-safe">
            <svg className="w-[12px] h-[12px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Vouched as safe by you
          </div>
        )}

        {isFlagged && (
          <div className="inline-flex items-center gap-[5px] text-[11px] font-semibold mt-[9px] py-[4px] px-[10px] rounded-full bg-coral-bg text-coral-text">
            <svg className="w-[11px] h-[11px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            Flagged as scam by you
          </div>
        )}

        {!isVouchedSafe && !isFlagged && isCaution && (
          <div className="inline-flex items-center gap-[5px] text-[11px] font-semibold mt-[9px] py-[4px] px-[10px] rounded-full bg-gold-bg text-gold-text">
            <svg className="w-[11px] h-[11px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a1.8 1.8 0 0 0 1.6 2.7h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
            </svg>
            Worth a second look
          </div>
        )}

        {!isVouchedSafe && !isFlagged && isRisk && (
          <div className="inline-flex items-center gap-[5px] text-[11px] font-semibold mt-[9px] py-[4px] px-[10px] rounded-full bg-coral-bg text-coral-text">
            <svg className="w-[11px] h-[11px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="9" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            Looks like a scam
          </div>
        )}

        {/* Expandable Explanation Panel */}
        {isExpandable && (
          <div
            className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
              isOpen ? 'grid-rows-[1fr] opacity-100 mt-[14px] pt-[15px] border-t border-line-soft' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <ExplanationCard
                explanation={email.explanation}
                reasons={email.reasons}
              />

              <CommunityNote
                count={email.communityCount}
                communityStatus={email.communityStatus}
                vouchedCount={email.communityVouchedCount}
                flaggedCount={email.communityFlaggedCount}
              />

              {/* Action Buttons */}
              <div className="mt-[14px] flex gap-[8px]">
                <button
                  onClick={() => onAction(email.id, 'safe')}
                  className="font-sans text-[12.5px] font-semibold py-[9px] px-[14px] rounded-[10px] border border-line bg-paper-raised text-ink hover:bg-paper active:scale-[0.97] transition cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-[13px] h-[13px] text-safe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Vouch as safe
                </button>
                <button
                  onClick={() => onAction(email.id, 'flag')}
                  className="font-sans text-[12.5px] font-semibold py-[9px] px-[14px] rounded-[10px] border border-coral/30 bg-coral-bg text-coral hover:bg-coral hover:text-white active:scale-[0.97] transition cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-[13px] h-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  Flag as scam
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chevron Icon on Expandable Rows */}
      {isExpandable && (
        <svg
          className={`w-[16px] h-[16px] flex-shrink-0 mt-[4px] text-ink-faint transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      )}
    </div>
  );
}

