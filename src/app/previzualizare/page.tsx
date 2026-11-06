import { normalizeWorkspaceTab } from '@/lib/workspace';
import { notFound } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import type { dashboard } from '@/lib/service';
import { documentStatus } from '@/lib/config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Previzualizare design', robots: { index: false, follow: false } };
export default async function DesignPreview({
  searchParams,
}: {
  searchParams: Promise<{ echipa?: string; device?:string; tab?:string; plan?:string; garage?:string }>;
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
    nextKm: r.kind === 'service' ? 140000 : null,
    odometer: r.kind === 'service' ? 125000 : null,
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
    premium: ['premium','paid'].includes(previewOptions.plan||''),
    planLimits:{activeVehicles:['premium','paid'].includes(previewOptions.plan||'')?null:1,attachments:30},
    premiumAccess: { paid: previewOptions.plan==='paid', paidUntil:previewOptions.plan==='paid'?new Date(Date.now()+30*86400000):new Date(0), manual: previewOptions.plan === 'premium' ? [{id:'design-only-grant',grantedAt:now,expiresAt:null}] : [] },
    pricing: {
      monthlyBani: 15000,
      annualBani: 170000,
      currency: 'ron',
      annualMonthlyBani: 180000,
      savingBani: 10000,
      savingPercent: 100 / 18,
    },
    subscription: {
      userId: 'design-only',
      customerId: null,
      subscriptionId: null,
      refundedInvoiceId: null,
      status: previewOptions.plan==='paid'?'active':'free',
      periodEnd: previewOptions.plan==='paid'?new Date(Date.now()+30*86400000):null,
      cancelAtPeriodEnd: false,
      updatedAt: now,
    },
    recentTrips: [],
    notifications: [],
    attachments: [],
    photos: [{ vehicleId: vehicles[0].id }],
    notificationSetup: { pushConfigured: false, emailConfigured: false },
    summary: { monthBani: 0, annualBani: 0, monthly: [], categories: {}, costPerKm: null, km: 0 },
    pushPublicKey: null,
  };
  if(previewOptions.garage==='empty'){data.vehicles=[];data.records=[];data.photos=[];}
  if(previewOptions.garage==='multi'){data.vehicles.push({...vehicles[0],id:'design-car-2',brand:'A doua',model:'Mașină',plate:'DEMO 02',odometer:83000});}
  const application=<Dashboard name="Vizitator" previewData={data} initialTab={normalizeWorkspaceTab(previewOptions.tab)} />;
  const deviceWidth = previewOptions.device==='phone'?390:previewOptions.device==='small'?320:previewOptions.device==='tablet'?768:null;
  const frameParams=new URLSearchParams(Object.entries(previewOptions).filter(([key,value])=>key!=='device'&&typeof value==='string') as [string,string][]);
  if(deviceWidth) return <div style={{padding:24,background:'#eaf0f8',minHeight:'100vh'}}><p style={{textAlign:'center'}}>AutoCare · Verificare interfață · Date fictive · {deviceWidth}px</p><iframe title="AutoCare — verificare responsive cu date fictive" src={'/previzualizare?'+frameParams.toString()} style={{display:'block',width:deviceWidth,maxWidth:'100%',height:844,margin:'20px auto',border:'1px solid #cedaeb',borderRadius:22,background:'white'}}/></div>;
  return application;
}
