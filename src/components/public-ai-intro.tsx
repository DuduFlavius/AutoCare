import Link from 'next/link';
import { ArrowUpRight, Sparkles, ShieldCheck, Wallet, Wrench, Files } from 'lucide-react';
import './public-ai-intro.css';

export function PublicAiIntro({ compact = false }: { compact?: boolean }) {
  return <section className="ac-public-ai" data-compact={compact || undefined} aria-labelledby={compact ? 'ac-ai-register-title' : 'ac-public-ai-title'}>
    <div className="ac-public-ai-heading"><span><Sparkles size={23} /></span><div><p>AUTOCARE AI · PREMIUM</p><h2 id={compact ? 'ac-ai-register-title' : 'ac-public-ai-title'}>Mașina ta are istoric. Acum are și un asistent.</h2></div></div>
    <p className="ac-public-ai-access">Exclusiv pentru abonații Premium. Conturile gratuite nu au acces la conversații sau scanare AI.</p>
    <p>Întreabă despre revizii, cheltuieli și documente. Primești explicații care folosesc datele vehiculului ales.</p>
    {!compact && <div className="ac-public-ai-grid">{[
      [Wallet, 'Înțelege costurile', 'Compară perioadele și vezi categoriile în care ai cheltuit cel mai mult.'],
      [Wrench, 'Pregătește următoarea revizie', 'Consultă termenele și pragurile de kilometraj înregistrate pentru mașină.'],
      [Files, 'Verifică documentele', 'Urmărește expirările și verifică datele extrase din documentele scanate înainte de salvare.'],
    ].map(([Icon, title, description]) => {const Symbol = Icon as typeof Wallet; return <article key={String(title)}><Symbol size={19} /><h3>{String(title)}</h3><p>{String(description)}</p></article>;})}</div>}
    <p className="ac-public-ai-note"><ShieldCheck size={14} />Inclus în toate planurile Premium, cu până la 120 de întrebări și 6 scanări pe zi. Conversații private pentru fiecare vehicul. Verifici informațiile extrase înainte de salvare.</p>
    {!compact && <div className="ac-public-ai-actions"><Link href="/inregistrare?next=%2Fcont%3Ftab%3DAutoCare%2BAI" className="button primary">Creează contul <ArrowUpRight size={15} /></Link><Link href="/autocare-ai">Cum funcționează AutoCare AI <ArrowUpRight size={14} /></Link></div>}
  </section>;
}
