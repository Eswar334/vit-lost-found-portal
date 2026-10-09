const DAY = 86400000;

/** "today", "yesterday", "3 days ago", or a date for anything older than a week. */
export function relativeDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / DAY);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const timeAgo = (iso) => {
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const dateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export const CLAIM_STATUS = {
  pending: 'Waiting for review',
  approved: 'Approved, handoff open',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  cancelled: 'Handoff cancelled',
  completed: 'Returned',
};

export const ITEM_STATUS = {
  open: 'Open',
  in_handoff: 'Handoff in progress',
  resolved: 'Returned',
};
