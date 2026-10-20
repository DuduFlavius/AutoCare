'use client';
import { useEffect, useState } from 'react';
import { BellRing, Send, ShieldCheck } from 'lucide-react';
export default function PushSettings({
  configured,
  emailConfigured,
  preview = false,
  onActivate,
  onTest,
}: {
  configured: boolean;
  emailConfigured: boolean;
  preview?: boolean;
  onActivate: () => Promise<void>;
  onTest: () => Promise<void>;
}) {
  const [permission, setPermission] = useState('loading'),
    [busy, setBusy] = useState(false),
    [needsInstall, setNeedsInstall] = useState(false);
  useEffect(() => {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone;
    setNeedsInstall(ios && !standalone);
    setPermission(
      'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
        ? Notification.permission
        : 'unsupported',
    );
  }, []);
  async function activate() {
    setBusy(true);
    try {
      await onActivate();
      if ('Notification' in window) setPermission(Notification.permission);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card push-settings">
      <div className="settings-section-title">
        <span className="list-icon">
          <BellRing size={23} />
        </span>
        <div>
          <p className="eyebrow">ALERTE PE DISPOZITIV</p>
          <h3>Notificări, ca într-o aplicație</h3>
        </div>
      </div>
      <p>
        Primește bannere pe telefon sau calculator pentru termenele tale. Browserul și sistemul
        trebuie să permită notificările.
      </p>
      <div className="push-state" role="status">
        <ShieldCheck size={16} />
        {needsInstall
          ? 'Pe iPhone/iPad: deschide în Safari → Partajează → Adaugă pe ecranul principal. Deschide apoi AutoCare din pictogramă și activează notificările. Necesită iOS/iPadOS 16.4 sau mai nou.'
          : permission === 'granted'
            ? 'Permisiune acordată pe acest dispozitiv'
            : permission === 'denied'
              ? 'Notificările sunt blocate. Permite-le din setările browserului pentru AutoCare.'
              : permission === 'unsupported'
                ? 'Acest browser nu suportă notificările Web Push. Încearcă aplicația web instalată sau un browser compatibil.'
                : permission === 'loading'
                  ? 'Verific dispozitivul…'
                  : 'Activează notificările și acceptă cererea browserului.'}
      </div>
      <div className="inline">
        <button
          className="primary"
          disabled={
            preview ||
            needsInstall ||
            busy ||
            !configured ||
            ['loading', 'denied', 'unsupported'].includes(permission)
          }
          onClick={() => void activate()}
        >
          <BellRing size={16} />
          {busy ? 'Se activează…' : 'Activează notificările'}
        </button>
        <button
          disabled={preview || needsInstall || busy || !configured || permission !== 'granted'}
          onClick={async () => {
            setBusy(true);
            try {
              await onTest();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send size={16} />
          Trimite notificare de test
        </button>
      </div>
      <p className="micro">
        Pe Android folosește Chrome. Pe PC permite notificările pentru acest site și verifică
        setările de notificări ale sistemului, inclusiv modul Nu deranjați. Dacă permisiunea este
        blocată, schimb-o din setările site-ului și reîncarcă pagina.
      </p>
      {!configured && <p className="small muted">Serviciul push trebuie configurat pe server.</p>}
      {!emailConfigured && (
        <p className="micro">
          Notificările pe dispozitiv sunt separate de e-mail. Trimiterea e-mailurilor necesită
          conectarea furnizorului.
        </p>
      )}
    </section>
  );
}
