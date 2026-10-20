export function savings(monthlyBani: number, annualBani: number) {
  const annualMonthly = monthlyBani * 12;
  return {
    annualMonthlyBani: annualMonthly,
    savingBani: annualMonthly - annualBani,
    savingPercent: annualMonthly ? ((annualMonthly - annualBani) / annualMonthly) * 100 : 0,
  };
}
