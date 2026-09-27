export { formatMoney } from '@shared/pricing';

// Set by I18nProvider so dates follow the chosen app language.
let locale: 'ka' | 'en' = 'ka';
export function setFormatLocale(lang: 'ka' | 'en') {
  locale = lang;
}
const tag = () => (locale === 'ka' ? 'ka-GE' : 'en-GB');

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(tag(), { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(tag(), { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatShiftTime(startsAt: string, endsAt: string): string {
  return `${formatDay(startsAt)} · ${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

export function formatRating(avg: number | null, count: number): string {
  if (count > 0 && avg != null) return `★ ${Number(avg).toFixed(1)} (${count})`;
  return locale === 'ka' ? 'ახალი' : 'New';
}

export function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}
