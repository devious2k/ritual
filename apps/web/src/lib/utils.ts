export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
}

export function degreeLabel(degree: string): string {
  const labels: Record<string, string> = {
    ENTERED_APPRENTICE: 'Entered Apprentice',
    FELLOW_CRAFT: 'Fellow Craft',
    MASTER_MASON: 'Master Mason',
  };
  return labels[degree] || degree;
}

export function degreeAbbrev(degree: string): string {
  const abbrevs: Record<string, string> = {
    ENTERED_APPRENTICE: 'EA',
    FELLOW_CRAFT: 'FC',
    MASTER_MASON: 'MM',
  };
  return abbrevs[degree] || degree;
}

export function roleLabel(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
