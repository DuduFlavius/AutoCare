import { migrate } from '../scripts/migrate';
import { auth } from '../src/lib/auth';
import { db, closeLocalDb } from '../src/lib/db';
import { createVehicle, saveRecord, dashboard } from '../src/lib/service';
import * as s from '../src/lib/schema';
import { eq } from 'drizzle-orm';
async function run() {
  delete process.env.DATABASE_URL;
  delete process.env.RESEND_API_KEY;
  process.env.BETTER_AUTH_SECRET = 'persistent-test-only-secret-at-least-32-characters';
  process.env.APP_URL = 'http://localhost:3000';
  if (process.argv[2] === 'create') {
    await migrate();
    const response = await auth().handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'persistent@example.invalid',
          password: 'persistent-test-password-123',
          name: 'Persistence Test',
        }),
      }),
    );
    if (response.status !== 200) throw new Error('Signup failed without mail configuration');
    const cookies = response.headers
      .getSetCookie()
      .map((x) => x.split(';')[0])
      .join('; ');
    const u = (
      await db().select().from(s.user).where(eq(s.user.email, 'persistent@example.invalid'))
    )[0];
    const v = await createVehicle(u.id, {
      brand: 'Test',
      model: 'Persistence',
      year: 2024,
      plate: 'TM-TEST',
      fuel: 'Electric',
      odometer: 12345,
    });
    await saveRecord(u.id, {
      vehicleId: v.id,
      kind: 'document',
      category: 'ITP',
      title: 'Persistent document',
      expiresAt: '2030-01-01',
    });
    await closeLocalDb();
    console.log(JSON.stringify({ uid: u.id, cookie: cookies }));
  } else {
    let input = '';
    for await (const c of process.stdin) input += c;
    const data = JSON.parse(input);
    const session = await auth().api.getSession({ headers: new Headers({ Cookie: data.cookie }) });
    if (session?.user.id !== data.uid) throw new Error('Session did not survive restart');
    const d = await dashboard(data.uid);
    if (
      d.vehicles.length !== 1 ||
      d.records.length !== 1 ||
      d.vehicles[0].odometer !== 12345 ||
      d.records[0].title !== 'Persistent document'
    )
      throw new Error('Data did not survive restart');
    await closeLocalDb();
    console.log(JSON.stringify({ restored: true }));
  }
}
run()
  .then(() => process.exit(0))
  .catch(() => {
    console.error('Persistence check failed');
    process.exit(1);
  });
