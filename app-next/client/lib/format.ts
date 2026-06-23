export const money = (n: number): string => {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
};

export const signed = (n: number): string => (n >= 0 ? `+${money(n)}` : money(n));
