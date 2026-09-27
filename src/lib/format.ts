export { formatMoney } from '@shared/pricing';

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatShiftTime(startsAt: string, endsAt: string): string {
  return `${formatDay(startsAt)} · ${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

export function formatRating(avg: number | null, count: number): string {
  return count > 0 && avg != null ? `★ ${Number(avg).toFixed(1)} (${count})` : 'New';
}

export function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}
