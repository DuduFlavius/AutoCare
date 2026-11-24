export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Previous estimate: through 25 November in Europe/Bucharest.
const maintenanceUntil = '2026-11-28T00:00:00+02:00';
export function GET() {
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex,nofollow"/><meta name="theme-color" content="#F6F9FB"/><title>AutoCare Premium — Lucrăm la o experiență mai bună</title><style>
  :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#F6F9FB;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#142333;padding:24px}
  .panel{width:min(100%,640px);padding:clamp(28px,6vw,56px);text-align:center;background:#fff;border:1px solid #E3EBF0;border-radius:24px;box-shadow:0 16px 55px #083b4a12}
  .brand{display:flex;align-items:center;justify-content:center;gap:12px;font-size:20px;font-weight:750;letter-spacing:-.5px}.logo{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:#EDF4F7;color:#075365;font-size:24px;font-weight:800}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;margin:30px auto 18px;padding:8px 12px;border-radius:99px;background:#EDF4F7;color:#075365;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase}.dot{height:7px;width:7px;background:#075365;border-radius:50%}
  h1{margin:0 auto 20px;font-size:clamp(28px,5.5vw,40px);line-height:1.15;letter-spacing:-1.2px}h1 span{color:#075365}p{margin:0 auto;color:#657584;font-size:15px;line-height:1.8}.apology{margin-top:16px;color:#142333}
  .date{display:grid;gap:7px;margin-top:28px;padding:20px;border-radius:16px;background:#EDF4F7}.date small{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#657584}.date strong{font-size:24px;color:#075365}.date em{font-size:12px;font-style:normal;color:#657584}
  .notice{display:flex;align-items:center;justify-content:center;gap:10px;margin:18px 0;padding:15px;border-radius:14px;background:#F6F9FB;color:#142333;font-size:13px;line-height:1.6}.tick{font-size:18px;color:#075365}.small{font-size:12px;color:#657584}.login{display:inline-flex;justify-content:center;margin-top:24px;padding:12px 22px;border-radius:12px;background:#075365;color:#fff;text-decoration:none;font-size:14px;font-weight:650}.login:hover{background:#083B4A}.login:focus-visible{outline:3px solid #20A6A6;outline-offset:4px}
  @media(max-width:480px){body{padding:14px}.panel{padding:30px 20px;border-radius:20px}.date strong{font-size:21px}}
  </style></head><body><main class="panel"><div class="brand"><span class="logo">A</span>AutoCare Premium</div><div class="eyebrow"><span class="dot"></span>Actualizare în desfășurare</div><h1>Pregătim o experiență <span>AutoCare și mai bună.</span></h1><p>Lucrăm la îmbunătățirea sistemului SmartDrive GPS, optimizarea performanței și introducerea unor actualizări importante pentru stabilitatea aplicației.</p><p class="apology">Îți mulțumim pentru răbdare!</p><div class="date"><small>Perioadă estimată de mentenanță</small><strong>Până la <time datetime="${maintenanceUntil}">27 noiembrie 2026, la sfârșitul zilei</time></strong><span id="maintenance-countdown" role="timer" aria-label="Timp estimat rămas"></span><em>Accesul va fi redeschis după finalizarea verificărilor.</em></div><div class="notice"><span class="tick">✓</span><span>Contul, vehiculele și documentele tale rămân păstrate în siguranță.</span></div><div class="small">Îți mulțumim că faci parte din comunitatea AutoCare Premium.</div><a class="login" href="/autentificare">Acces cont</a></main><script>
  (() => {
    const output = document.getElementById('maintenance-countdown');
    const deadline = Date.parse(document.querySelector('time[datetime]').dateTime);
    function update() {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (!seconds) {
        output.textContent = 'Verificările sunt încă în desfășurare.';
        return;
      }
      const days = Math.floor(seconds / 86400);
      const clock = [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60]
        .map(value => String(value).padStart(2, '0')).join(':');
      output.textContent = (days ? days + (days === 1 ? ' zi · ' : ' zile · ') : '') + clock;
      window.setTimeout(update, 1000);
    }
    update();
  })();
  </script></body></html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '3600', 'X-Robots-Tag': 'noindex, nofollow' } });
}
