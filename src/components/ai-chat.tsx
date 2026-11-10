'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, Send, LoaderCircle } from 'lucide-react';

type Message = { role: 'user' | 'model'; text: string };
const suggestions = [
  'Ce înseamnă martorul Check Engine?',
  'La cât timp se schimbă uleiul?',
  'De ce tremură motorul la relanti?',
];
export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(event?: FormEvent, suggestion?: string) {
    event?.preventDefault();
    const text = (suggestion ?? draft).trim();
    if (!text || busy) return;
    const next: Message[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-12) }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nu am primit un răspuns.');
      setMessages((current) => [...current, { role: 'model', text: data.text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare de conexiune.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main style={{ minHeight: '100vh', background: '#0b1220', color: '#e8eef9', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <Link href="/cont" style={{ color: '#93c5fd', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <ArrowLeft size={18} /> Înapoi la cont
        </Link>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#172c50', borderRadius: 18, padding: 14 }}><Bot size={30} color="#60a5fa" /></div>
          <div><h1 style={{ fontSize: 30, margin: 0 }}>AutoCare AI</h1><p style={{ color: '#9aaec9', margin: '5px 0' }}>Asistentul tău auto inteligent</p></div>
        </header>
        <section aria-label="Conversație AutoCare AI" aria-live="polite" style={{ background: '#111c30', border: '1px solid #263852', borderRadius: 20, padding: 20, minHeight: 350, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.length === 0 && <>
            <p>Salut! Sunt AutoCare AI. Întreabă-mă orice despre mașina ta, întreținere sau posibile defecțiuni.</p>
            <p style={{ color: '#9aaec9', fontSize: 14 }}>Alege o întrebare sau scrie propriul mesaj:</p>
            {suggestions.map((s) => <button key={s} type="button" onClick={() => void send(undefined, s)} style={{ textAlign: 'left', background: '#1c2b45', border: '1px solid #304665', borderRadius: 12, color: '#dbeafe', padding: 12, cursor: 'pointer' }}>{s}</button>)}
          </>}
          {messages.map((m, i) => <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: m.role === 'user' ? '#1d4ed8' : '#22324c', borderRadius: 14, padding: '12px 16px', lineHeight: 1.6 }}>{m.text}</div>)}
          {busy && <p style={{ color: '#9aaec9', display: 'flex', alignItems: 'center', gap: 8 }}><LoaderCircle size={16} /> AutoCare AI scrie...</p>}
        </section>
        {error && <p role="alert" style={{ color: '#fca5a5' }}>{error} {error.includes('Autentifică-te') && <Link href="/autentificare">Intră în cont</Link>}</p>}
        <form onSubmit={(e) => void send(e)} style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <input aria-label="Mesaj pentru AutoCare AI" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={3000} placeholder="Scrie întrebarea ta..." style={{ flex: 1, minWidth: 0, border: '1px solid #334763', borderRadius: 12, padding: 14, color: 'white', background: '#17253c' }} />
          <button type="submit" disabled={busy || !draft.trim()} style={{ background: '#2563eb', color: 'white', border: 0, borderRadius: 12, padding: '12px 18px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}><Send size={20} /></button>
        </form>
        <p style={{ color: '#91a4c0', fontSize: 12, marginTop: 14 }}>Răspunsurile AI sunt orientative și nu înlocuiesc verificarea într-un service. Nu introduce date personale sensibile. În această versiune conversația nu este salvată în cont și AI-ul nu accesează încă garajul.</p>
      </div>
    </main>
  );
}
