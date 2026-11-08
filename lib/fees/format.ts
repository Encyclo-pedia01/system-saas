// Money is stored as whole pesewas (1 cedi = 100 pesewas). These helpers convert at the edges only.

const ghsFormatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' });

// Accepts "150", "150.5", "1,250.00". Returns null when the text is not a positive amount.
export function parseGhsToPesewas(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const pesewas = Math.round(Number(cleaned) * 100);
  return pesewas > 0 ? pesewas : null;
}

export function formatGhs(pesewas: number): string {
  return ghsFormatter.format(pesewas / 100);
}

// Today's date in Ghana (Africa/Accra), as YYYY-MM-DD, for date inputs.
export function todayInAccra(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export const paymentMethodLabels: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile money',
  bank: 'Bank transfer',
  other: 'Other',
};
