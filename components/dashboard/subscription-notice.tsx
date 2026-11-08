// Shown to school owners when the subscription is close to ending, in grace, or expired.
export function SubscriptionNotice({ state, endsOn, today }: { state: string | null; endsOn: string | null; today: string }) {
  if (!endsOn || !state || state === 'open') return null;

  const daysUntilEnd = Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const endText = new Date(`${endsOn}T00:00:00Z`).toLocaleDateString('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

  if (state === 'expired') {
    return (
      <div role="alert" className="notice rounded-2xl p-5 text-sm">
        <p className="font-semibold text-[var(--danger)]">Your subscription has ended</p>
        <p className="mt-1 text-[var(--muted)]">
          It ended on {endText}. Changes are paused, but you can still view and export your records. Ask the platform administrator to renew it.
        </p>
      </div>
    );
  }

  if (state === 'grace') {
    const graceDaysLeft = 7 + daysUntilEnd;
    return (
      <div role="alert" className="notice rounded-2xl p-5 text-sm">
        <p className="font-semibold text-[var(--warning)]">Your subscription has ended</p>
        <p className="mt-1 text-[var(--muted)]">
          It ended on {endText}. You can still make changes for {graceDaysLeft} more day{graceDaysLeft === 1 ? '' : 's'}. Renew before then to avoid a pause.
        </p>
      </div>
    );
  }

  if (daysUntilEnd <= 14) {
    return (
      <div role="status" className="notice rounded-2xl p-5 text-sm">
        <p className="font-semibold">Your subscription ends soon</p>
        <p className="mt-1 text-[var(--muted)]">
          Access continues until {endText} ({daysUntilEnd} day{daysUntilEnd === 1 ? '' : 's'} left). Contact the platform administrator to renew.
        </p>
      </div>
    );
  }

  return null;
}
