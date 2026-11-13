'use client';
import { useEffect } from 'react';
export default function AccountError({ reset }: { reset: () => void }) {
  useEffect(() => {
    document.title = 'Reîncărcare garaj | AutoCare';
  }, []);
  return (
    <main
      style={{
        maxWidth: 600,
        margin: '12vh auto',
        padding: 28,
        fontFamily: 'system-ui',
        color: '#193858',
      }}
    >
      <p style={{ fontSize: 12, letterSpacing: 2, color: '#6685ab' }}>AUTOCARE · GARAJUL TĂU</p>
      <h1>Nu am putut afișa această secțiune.</h1>
      <p>Datele deja salvate rămân în contul tău. Reîncarcă secțiunea pentru a continua.</p>
      <button
        type="button"
        onClick={reset}
        style={{
          background: '#245fa9',
          color: 'white',
          border: 0,
          borderRadius: 10,
          padding: '14px 20px',
          fontWeight: 700,
        }}
      >
        Reîncearcă
      </button>{' '}
      <a href="/cont">Deschide garajul</a>
    </main>
  );
}
