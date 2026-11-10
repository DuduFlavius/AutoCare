'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Send, Sparkles } from 'lucide-react';

export function AutoAssistant({
  vehicleId, available, premium, en, onPremium, onOpen,
}: {
  vehicleId: string;
  available: boolean;
  premium: boolean;
  en: boolean;
  onPremium: () => void;
  onOpen: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || request.current || question.trim().length < 4) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(false);
    setAnswer('');
    try {
      const response = await fetch('/api/v1/auto-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ vehicleId, question, language: en ? 'en' : 'ro' }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.answer !== 'string') throw new Error('Assistant unavailable');
      setAnswer(result.answer);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <section className="ac-titanium-assistant" aria-labelledby="ac-assistant-title">
      <div className="ac-assistant-icon"><Sparkles size={22} aria-hidden="true" /></div>
      <div>
        <h2 id="ac-assistant-title">AI Auto Assistant</h2>
        {available ? (
          <>
            <p>{en ? 'Ask about service, documents or recorded expenses.' : 'Întreabă despre revizii, documente sau costurile înregistrate.'}</p>
            <form onSubmit={ask} aria-busy={pending}>
              <input aria-label={en ? 'Your question' : 'Întrebarea ta'} value={question} onChange={e => setQuestion(e.target.value)} minLength={4} maxLength={500} required placeholder={en ? 'When is my next service?' : 'Când urmează revizia?'} />
              <button className="primary" type="submit" disabled={pending} aria-label={en ? 'Send question' : 'Trimite întrebarea'}><Send size={17} /></button>
            </form>
            <small>{en ? 'Your question and selected vehicle records are sent to the AI provider. Avoid including personal data.' : 'Întrebarea și datele relevante ale mașinii sunt trimise către furnizorul AI. Evită datele personale.'}</small>
            {pending && <p role="status">{en ? 'Preparing your answer…' : 'Se pregătește răspunsul…'}</p>}
            {error && <p role="alert">{en ? 'The assistant is unavailable right now. Try again later.' : 'Asistentul este momentan indisponibil. Reîncearcă mai târziu.'}</p>}
            {answer && <p className="ac-assistant-answer" role="status">{answer}</p>}
          </>
        ) : (
          <p>{premium ? (en ? 'The AI provider is not configured for this installation.' : 'Furnizorul AI încă nu este configurat.') : (en ? 'A Premium feature, subject to AI provider availability.' : 'Funcție Premium, disponibilă când este configurat furnizorul AI.')}</p>
        )}
        {premium && <button type="button" className="studio-text-button" onClick={onOpen}>{en ? 'Open AutoCare AI' : 'Deschide AutoCare AI'} <ArrowUpRight size={14} /></button>}
        {!premium && <button type="button" className="studio-text-button" onClick={onPremium}>Premium <ArrowUpRight size={14} /></button>}
      </div>
    </section>
  );
}
