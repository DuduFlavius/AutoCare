> Starea actuală este documentată în docs/RELEASE_STATUS.md (sau RELEASE_STATUS.md din acest director). Restricția anterioară de recuperare a sursei este rezolvată.

> Actualizare 20.10.2026: această arhivă include redesignul premium bazat pe referințele utilizatorului. Citește `docs/REDESIGN_2026_10_20.md` înainte de publicare. Arhiva de bază este mai veche decât producția; reconcilierea cu sursele curente este obligatorie pentru a păstra corecțiile ulterioare.

# AutoCare — implementare MVP

Aplicație Next.js în română pentru administrarea mașinilor. Cod implementat, nu doar machetă. **Nu este încă un serviciu public lansat.** Baza Neon, emailul, Stripe și Web Push trebuie configurate și probate cu conturile proprietarului.

## Începe aici

1. Instalează Node.js 24 LTS și extrage arhiva.
2. Rulează `npm ci` în directorul `autocare`.
3. Copiază `.env.example` ca `.env.local` și completează secretele. Nu trimite acest fișier în Git și nu îl încărca în conversații.
4. Pentru dezvoltare fără Neon: lasă `DATABASE_URL` gol și folosește `LOCAL_DATABASE_PATH=.local/postgres`. Este PostgreSQL integrat prin PGlite, exclus din Vercel și din producție în configurația normală.
5. Încarcă mediul pentru migrații: `node --env-file=.env.local --import tsx scripts/migrate.ts`.
6. Rulează `npm run dev` și deschide `http://localhost:3000`.
7. Configurează Resend înainte de înregistrare: confirmarea emailului este obligatorie. Nu există cont implicit sau ocolire a confirmării în aplicație.

În PowerShell, comenzile Node cu `--env-file` funcționează la fel. Pentru dezvoltare, `next dev` încarcă automat `.env.local`; scripturile independente au nevoie explicit de `--env-file`.

## Comenzi

| Comandă                                                                                | Scop                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run typecheck`                                                                    | Verificare TypeScript                                                   |
| `npm test`                                                                             | Teste automate izolate, fără emailuri sau plăți reale                   |
| `npm run build`                                                                        | Build Next.js de producție                                              |
| `npm start`                                                                            | Rulare build; în producție necesită PostgreSQL extern                   |
| `node --env-file=.env.local --import tsx scripts/check-config.ts`                      | Verifică prezența configurației fără a tipări secrete                   |
| `node --env-file=.env.local --import tsx scripts/set-admin.ts emailul-tau`             | Acordă rol admin unui cont existent și confirmat; acțiunea se auditează |
| `node --env-file=.env.local --import tsx scripts/backup.ts create /cale/backup.enc`    | Backup criptat nou; nu suprascrie fișiere                               |
| `node --env-file=.env.restore --import tsx scripts/backup.ts restore /cale/backup.enc` | Restaurare într-o bază izolată goală                                    |

## Documentația livrată

- [Audit și costuri](docs/AUDIT.md): arhitectură, limitări comerciale, surse și buget.
- [Configurare și operare](docs/OPERATIONS.md): Neon, Vercel, email, scheduler, push, Stripe, backup și retenție.
- [Starea implementării](docs/STATUS.md): ce există, ce nu a fost verificat și ce rămâne ulterior.
- [Raport de verificare](docs/TEST_REPORT.md): comenzi și rezultate efectiv executate.
- [API și date](docs/ARCHITECTURE.md): structură, autorizare și model.

## Limite importante

Plățile sunt **numai Stripe test**; cheile live sunt refuzate în cod. Nu sunt incluse credențiale, conturi sau date demo. Atașamentele mici sunt private în PostgreSQL, cu limită de 2 MB/fișier; mutarea în object storage este recomandată înainte de creșterea volumului. OCR, SMS, familii, flote și aplicații native nu sunt implementate.

În acest mediu nu a fost disponibilă verificarea vizuală în browser. Build-ul și testele automate nu echivalează cu validarea pe telefon, livrarea reală a emailului sau un checkout efectuat în contul tău Stripe.
