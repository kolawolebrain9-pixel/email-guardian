import React from 'react';

export default function ExplanationCard({ explanation, reasons = [] }) {
  // Helper to render markdown-like backticks `code` into <code> tags
  const renderReasonText = (text) => {
    if (!text) return null;
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={index}
            className="font-mono text-[12px] bg-paper-raised border border-line px-[6px] py-[1px] rounded-[5px] text-ink"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Helper to render safe bold tags without dangerouslySetInnerHTML
  const renderFormattedText = (text) => {
    if (!text) return null;
    const parts = text.split(/(<b>.*?<\/b>|<strong>.*?<\/strong>)/gi);
    return parts.map((part, index) => {
      const bMatch = part.match(/^<b>(.*?)<\/b>$/i) || part.match(/^<strong>(.*?)<\/strong>$/i);
      if (bMatch) {
        return (
          <strong key={index} className="text-teal-deep font-semibold">
            {bMatch[1]}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex gap-2 sm:gap-[11px] items-start">
      {/* Teal Shield Avatar */}
      <div className="w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] rounded-full bg-gradient-to-br from-teal to-teal-deep flex-shrink-0 flex items-center justify-center shadow-avatar mt-0.5">
        <svg className="w-[13px] h-[13px] sm:w-[15px] sm:h-[15px]" viewBox="0 0 24 24" fill="none">
          <path d="M12 2 4 5v6c0 5.2 3.4 9.6 8 11 4.6-1.4 8-5.8 8-11V5l-8-3Z" fill="#fff" />
        </svg>
      </div>

      {/* Conversational Speech Bubble */}
      <div className="bg-paper border border-line rounded-tl-[4px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] p-[10px_12px] sm:p-[13px_15px] text-[13px] sm:text-[14px] leading-[1.55] sm:leading-[1.6] text-ink flex-1 min-w-0">
        {explanation && (
          <div className="speech-text text-[13px] sm:text-[14px] leading-[1.55] sm:leading-[1.6]">
            {renderFormattedText(explanation)}
          </div>
        )}

        {reasons && reasons.length > 0 && (
          <ul className="m-0 mt-2 sm:mt-[11px] p-0 list-none flex flex-col gap-1.5 sm:gap-[7px]">
            {reasons.map((reason, idx) => (
              <li
                key={idx}
                className="text-[12px] sm:text-[13px] text-ink-soft flex gap-2 items-start leading-[1.45] sm:leading-[1.5]"
              >
                <span className="w-[4px] h-[4px] rounded-full bg-ink-faint mt-[6px] sm:mt-[7px] flex-shrink-0" />
                <span className="flex-1 break-words">{renderReasonText(reason)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

