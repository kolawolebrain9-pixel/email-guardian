import { config } from '../config.js';

/**
 * Generate a calm, warm, friend-to-friend explanation (<60 words) for flagged emails.
 * Calls OpenAI/Anthropic if an API key is present, otherwise uses conversational heuristics.
 */
export async function generateFriendlyExplanation(email, reasons, riskLevel) {
  if (riskLevel === 'safe' || !reasons || reasons.length === 0) {
    return null;
  }

  // 1. Check if OpenAI API key is available
  if (config.openaiApiKey && !config.openaiApiKey.includes('your-openai-api-key')) {
    try {
      const prompt = `Explain to a non-technical person, in a calm and reassuring tone, why this email is suspicious.
Email Subject: "${email.subject}"
Sender: "${email.senderName} <${email.senderAddress}>"
Reasons:
${reasons.map((r) => `- ${r}`).join('\n')}

Rules:
- Write like a knowledgeable, calm friend explaining it over coffee.
- Do NOT use security jargon or panic language.
- Keep it under 60 words (2-3 sentences max).
- Return ONLY the explanation paragraph.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 120
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch (err) {
      console.warn('LLM API call failed, using intelligent template fallback:', err.message);
    }
  }

  // 2. Intelligent friend-toned template generator fallback
  return generateFallbackExplanation(email, reasons, riskLevel);
}

function generateFallbackExplanation(email, reasons, riskLevel) {
  const reasonsText = reasons.join(' ').toLowerCase();
  const senderName = email.senderName || 'this sender';

  if (reasonsText.includes('vouch community') || reasonsText.includes('reported as a scam by')) {
    return `Another Vouch member already flagged this exact email as a scam. The community has got your back — do not click any links or reply to the sender.`;
  }

  if (reasonsText.includes('urgency') || reasonsText.includes('pressure') || reasonsText.includes('within 24 hours')) {
    if (reasonsText.includes('spoofed') || reasonsText.includes('link text')) {
      return `This one is trying to rush you. It creates artificial urgency so you click without checking — that pressure is the giveaway. The link underneath doesn't actually connect to the real service.`;
    }
    return `This email is using pressure tactics to make you act fast before thinking. Legitimate services won't shut down your account or lock you out on short notice like this.`;
  }

  if (reasonsText.includes('not a real') || reasonsText.includes('impersonat')) {
    return `The sender says they're ${senderName}, but their actual email address tells a different story. Nothing in this message connects to the official company.`;
  }

  if (reasonsText.includes('spoofed') || reasonsText.includes('points to')) {
    return `Take a close look at the buttons or links. The visible text looks trustworthy, but clicking it takes you to a completely different, unverified website.`;
  }

  if (riskLevel === 'risk') {
    return `This looks like a classic impersonation scam built to make you panic-click before checking the details. It's best not to reply or click any links inside.`;
  }

  return `This message is worth a second look before clicking anything. A few details about the sender and links don't quite match what we'd expect from a legitimate email.`;
}

