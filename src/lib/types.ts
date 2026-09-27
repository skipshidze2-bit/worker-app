export type Role = 'worker' | 'employer' | 'admin';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  photo_url: string | null;
  bio: string | null;
  skills: string[];
  languages: string[];
  areas: string[];
  id_status: 'pending' | 'approved' | 'rejected';
  rating_avg: number | null;
  rating_count: number;
  shifts_completed: number;
  strikes: number;
  suspended: boolean;
};

export type PrivateProfile = {
  id: string;
  phone: string | null;
  has_payment_method: boolean;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
};

export type ShiftStatus = 'open' | 'filled' | 'completed' | 'cancelled';

export type Shift = {
  id: string;
  employer_id: string;
  business_id: string;
  role_title: string;
  category: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  workers_needed: number;
  hourly_rate_cents: number;
  currency: string;
  area: string;
  status: ShiftStatus;
  is_urgent: boolean;
  favorites_only_until: string | null;
  businesses?: { name: string } | null;
  employer?: Pick<Profile, 'rating_avg' | 'rating_count'> | null;
};

export type ShiftLocation = {
  shift_id: string;
  address: string;
  lat: number;
  lng: number;
  instructions: string | null;
};

export type BookingStatus =
  | 'pending_payment'
  | 'claimed'
  | 'checked_in'
  | 'checked_out'
  | 'confirmed'
  | 'paid'
  | 'no_show'
  | 'cancelled_by_worker'
  | 'cancelled_by_employer'
  | 'disputed';

export type Booking = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: BookingStatus;
  is_repeat: boolean;
  wage_cents: number | null;
  fee_cents: number | null;
  payout_cents: number | null;
  check_in_at: string | null;
  check_out_at: string | null;
  confirmed_minutes: number | null;
  created_at: string;
  shifts?: Shift;
  worker?: Profile;
};

export type Message = {
  id: number;
  booking_id: string;
  sender_id: string;
  body: string;
  was_masked: boolean;
  created_at: string;
};

export const CATEGORIES = ['Waiter', 'Kitchen', 'Bartender', 'Cleaner', 'Mover', 'Warehouse', 'Events', 'Retail'] as const;

export const BOOKING_LABELS: Record<BookingStatus, string> = {
  pending_payment: 'Processing',
  claimed: 'Booked',
  checked_in: 'Checked in',
  checked_out: 'Waiting for hours confirmation',
  confirmed: 'Hours confirmed, payout pending',
  paid: 'Paid',
  no_show: 'No-show',
  cancelled_by_worker: 'Cancelled by worker',
  cancelled_by_employer: 'Cancelled by employer',
  disputed: 'In dispute',
};
