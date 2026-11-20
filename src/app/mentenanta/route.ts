export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex,nofollow"/><title>AutoCare Premium — Revenim în curând</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(ellipse at 20% 5%,#143f32 0%,#081b16 58%,#06120f 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#f5fbf7;padding:24px}
  .panel{width:min(100%,570px);padding:clamp(30px,6vw,58px);text-align:center;background:rgba(18,55,42,.72);border:1px solid rgba(153,220,173,.19);border-radius:28px;box-shadow:0 24px 80px rgba(0,0,0,.25)}
  .brand{display:flex;align-items:center;justify-content:center;gap:10px;font-size:19px;font-weight:750;letter-spacing:-.4px}.logo{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#b7f2c6;color:#103b2b;font-weight:900}
  .icon{width:72px;height:72px;border-radius:22px;display:grid;place-items:center;margin:40px auto 26px;background:rgba(156,237,178,.12);border:1px solid rgba(156,237,178,.18);font-size:32px}
  h1{font-size:clamp(28px,5vw,38px);line-height:1.14;letter-spacing:-1.2px;margin:0 0 18px}p{color:#c2d7cb;font-size:16px;line-height:1.8;margin:0}
  .notice{margin:30px 0 24px;padding:16px;border-radius:14px;background:rgba(165,235,182,.08);color:#d5eddb;font-size:14px}
  .small{font-size:13px;color:#a7c1b0}.login{display:inline-block;margin-top:24px;color:#b7f2c6;font-size:13px;text-decoration:underline;text-underline-offset:4px}
  </style></head><body><main class="panel"><div class="brand"><span class="logo">A</span>AutoCare Premium</div><div class="icon" aria-hidden="true">✦</div><h1>Pregătim ceva și mai bun pentru tine.</h1><p>AutoCare Premium se află temporar în mentenanță pentru îmbunătățiri. Revenim în curând cu o experiență și mai plăcută.</p><div class="notice">✓ Contul, vehiculele și documentele tale rămân în siguranță.</div><div class="small">Îți mulțumim pentru răbdare!</div><a class="login" href="/autentificare">Acces cont</a></main></body></html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '3600', 'X-Robots-Tag': 'noindex, nofollow' } });
}
