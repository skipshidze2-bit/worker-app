// Detects and hides contact details in chat messages so workers and employers
// can't move the relationship off the app. Used server-side by the
// send-message function (authoritative) and client-side to warn before sending.

export const MASK = '[hidden]';

export type MaskReason = 'phone' | 'email' | 'url' | 'handle' | 'off_app_keyword';

export type MaskResult = {
  text: string;
  masked: boolean;
  reasons: MaskReason[];
};

const DIGIT_WORDS: Record<string, number> = {
  zero: 1, oh: 1, one: 1, two: 1, three: 1, four: 1, five: 1, six: 1, seven: 1, eight: 1, nine: 1,
  double: 0, triple: 0,
};
const DIGIT_WORD_ALT = Object.keys(DIGIT_WORDS).join('|');

// A run of digits and/or spelled-out digits separated by spaces or punctuation.
const NUMBER_RUN = new RegExp(
  `\\+?(?:\\d+|\\b(?:${DIGIT_WORD_ALT})\\b)(?:[\\s,.\\-_/()+]*(?:\\d+|\\b(?:${DIGIT_WORD_ALT})\\b))*`,
  'gi',
);
const MIN_PHONE_DIGITS = 7;

const EMAIL =
  /[\w.+-]+\s*(?:@|\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+)\s*[\w-]+(?:\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)\s*[\w-]+)*\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)\s*(?:com|net|org|io|me|co|ge|ru|de|uk|edu|gov|info|biz|[a-z]{2})\b/gi;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b(?:wa\.me|t\.me|m\.me|ig\.me|bit\.ly)\/\S*/gi;
const HANDLE = /(^|[\s(])@[a-z0-9_.]{3,}/gi;
const OFF_APP =
  /\b(?:whats\s*app|whatsapp|wa|telegram|tg|viber|signal|insta(?:gram)?|ig|snap(?:chat)?|facebook|fb|messenger|tiktok|linkedin|my\s+(?:number|phone|cell|mobile|email|e-mail)|call\s+me|text\s+me|dm\s+me|pay\s+(?:you|me)\s+(?:in\s+)?cash|off\s+(?:the\s+)?app|outside\s+(?:the\s+)?app)\b/gi;

function countDigits(run: string): number {
  let count = 0;
  for (const token of run.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!token) continue;
    if (/^\d+$/.test(token)) count += token.length;
    else count += DIGIT_WORDS[token] ?? 0;
  }
  return count;
}

export function maskContactInfo(input: string): MaskResult {
  const reasons = new Set<MaskReason>();
  let text = input;

  text = text.replace(URL, () => {
    reasons.add('url');
    return MASK;
  });
  text = text.replace(EMAIL, () => {
    reasons.add('email');
    return MASK;
  });
  text = text.replace(NUMBER_RUN, (run) => {
    if (countDigits(run) < MIN_PHONE_DIGITS) return run;
    reasons.add('phone');
    return MASK;
  });
  text = text.replace(HANDLE, (_m, lead: string) => {
    reasons.add('handle');
    return `${lead}${MASK}`;
  });
  text = text.replace(OFF_APP, () => {
    reasons.add('off_app_keyword');
    return MASK;
  });

  return { text, masked: reasons.size > 0, reasons: [...reasons] };
}
