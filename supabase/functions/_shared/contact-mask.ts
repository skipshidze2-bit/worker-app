// Detects and hides contact details in chat messages so workers and employers
// can't move the relationship off the app. Used server-side by the
// send-message function (authoritative) and client-side to warn before sending.

export const MASK = '[•••]';

export type MaskReason = 'phone' | 'email' | 'url' | 'handle' | 'off_app_keyword';

export type MaskResult = {
  text: string;
  masked: boolean;
  reasons: MaskReason[];
};

// Spelled-out digits in English, Georgian and Russian, with how many digits each stands for.
const DIGIT_WORDS: Record<string, number> = {
  zero: 1, oh: 1, one: 1, two: 1, three: 1, four: 1, five: 1, six: 1, seven: 1, eight: 1, nine: 1,
  double: 0, triple: 0,
  ნული: 1, ერთი: 1, ორი: 1, სამი: 1, ოთხი: 1, ხუთი: 1, ექვსი: 1, შვიდი: 1, რვა: 1, ცხრა: 1,
  ათი: 2, თერთმეტი: 2, თორმეტი: 2, ცამეტი: 2, თოთხმეტი: 2, თხუთმეტი: 2, თექვსმეტი: 2, ჩვიდმეტი: 2,
  თვრამეტი: 2, ცხრამეტი: 2, ოცი: 2,
  ноль: 1, один: 1, два: 1, три: 1, четыре: 1, пять: 1, шесть: 1, семь: 1, восемь: 1, девять: 1,
};
const DIGIT_WORD_ALT = Object.keys(DIGIT_WORDS).join('|');
// \b only understands Latin letters, so word edges are spelled out for Georgian and Cyrillic.
const WORD = `(?<![\\p{L}\\p{N}])(?:${DIGIT_WORD_ALT})(?![\\p{L}\\p{N}])`;

// A run of digits and/or spelled-out digits separated by spaces or punctuation.
const NUMBER_RUN = new RegExp(`\\+?(?:\\d+|${WORD})(?:[\\s,.\\-_/()+]*(?:\\d+|${WORD}))*`, 'giu');
const MIN_PHONE_DIGITS = 7;

const EMAIL =
  /[\w.+-]+\s*(?:@|\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+)\s*[\w-]+(?:\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)\s*[\w-]+)*\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)\s*(?:com|net|org|io|me|co|ge|ru|de|uk|edu|gov|info|biz|[a-z]{2})\b/gi;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b(?:wa\.me|t\.me|m\.me|ig\.me|bit\.ly)\/\S*/gi;
const HANDLE = /(^|[\s(])@[a-z0-9_.]{3,}/gi;
// Georgian and Russian names of messengers and "call me / my number", with any suffix
// (e.g. ვოცაპში "on WhatsApp").
const OFF_APP_LOCAL =
  /(?<![\p{L}])(?:ვ[ოა][ცტთ]?ს?აპ|ტელეგრამ|ინსტა|ფეისბუქ|ვაიბერ|სნეპჩატ|ტიკტოკ|დამირეკ|ჩემი\s+ნომ|ჩემს\s+ნომ|ват[сc]ап|вот[сc]ап|телеграм|инста|вайбер|позвони|мой\s+номер)\p{L}*/giu;
const OFF_APP =
  /\b(?:whats\s*app|whatsapp|wa|telegram|tg|viber|signal|insta(?:gram)?|ig|snap(?:chat)?|facebook|fb|messenger|tiktok|linkedin|my\s+(?:number|phone|cell|mobile|email|e-mail)|call\s+me|text\s+me|dm\s+me|pay\s+(?:you|me)\s+(?:in\s+)?cash|off\s+(?:the\s+)?app|outside\s+(?:the\s+)?app)\b/gi;

function countDigits(run: string): number {
  let count = 0;
  for (const token of run.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
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
  text = text.replace(OFF_APP_LOCAL, () => {
    reasons.add('off_app_keyword');
    return MASK;
  });

  return { text, masked: reasons.size > 0, reasons: [...reasons] };
}
