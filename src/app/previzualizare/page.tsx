import { notFound } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import type { dashboard } from '@/lib/service';
import { documentStatus } from '@/lib/config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Previzualizare design', robots: { index: false, follow: false } };
export default async function DesignPreview({
  searchParams,
}: {
  searchParams: Promise<{ echipa?: string }>;
}) {
  const previewOptions = await searchParams;
  if (process.env.VERCEL_ENV === 'production') notFound();
  const now = new Date(),
    today = now.toISOString().slice(0, 10);
  const future = (days: number) =>
    new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
  const vehicles = [
    {
      id: 'design-car-1',
      userId: 'design-only',
      brand: 'Garaj',
      model: 'Exemplu',
      year: 2020,
      plate: 'DEMO 01',
      vin: null,
      engine: '2.0',
      fuel: 'Diesel',
      capacity: 2000,
      odometer: 125000,
      purchasedAt: null,
      notes: 'Mașină fictivă folosită exclusiv pentru prezentarea interfeței.',
      archived: false,
      createdAt: now,
    },
  ];
  const entries = [
    {
      id: 'design-rca',
      kind: 'document',
      category: 'RCA',
      title: 'Reînnoire RCA',
      expiresAt: future(10),
      date: today,
    },
    {
      id: 'design-service',
      kind: 'service',
      category: 'Revizie',
      title: 'Schimb de ulei și filtre',
      expiresAt: future(45),
      date: today,
    },
    {
      id: 'design-itp',
      kind: 'document',
      category: 'ITP',
      title: 'Inspecție tehnică periodică',
      expiresAt: future(65),
      date: today,
    },
  ];
  const records = entries.map((r) => ({
    ...r,
    vehicleId: vehicles[0].id,
    userId: 'design-only',
    nextKm: null,
    odometer: null,
    amountBani: 0,
    amountKnown: true,
    provider: null,
    number: null,
    notes: null,
    parts: null,
    cancelled: false,
    revision: 1,
    createdAt: now,
    status: documentStatus(r.expiresAt, now),
  }));
  const data: Awaited<ReturnType<typeof dashboard>> = {
    profile: {
      userId: 'design-only',
      timezone: 'Europe/Bucharest',
      emailEnabled: false,
      pushEnabled: false,
      afterExpiry: false,
      offsets: [30, 7, 1, 0],
      hour: 9,
      role: previewOptions.echipa === '1' ? 'admin' : 'user',
    },
    vehicles,
    records,
    premium: false,
    premiumAccess: { paid: false, manual: [] },
    pricing: {
      monthlyBani: 5000,
      annualBani: 50000,
      currency: 'ron',
      annualMonthlyBani: 60000,
      savingBani: 10000,
      savingPercent: 100 / 6,
    },
    subscription: {
      userId: 'design-only',
      customerId: null,
      subscriptionId: null,
      refundedInvoiceId: null,
      status: 'free',
      periodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: now,
    },
    notifications: [],
    attachments: [],
    photos: [{ vehicleId: vehicles[0].id }],
    notificationSetup: { pushConfigured: false, emailConfigured: false },
    summary: { monthBani: 0, annualBani: 0, monthly: [], categories: {}, costPerKm: null, km: 0 },
    pushPublicKey: null,
  };
  return <Dashboard name="Vizitator" previewData={data} />;
}
