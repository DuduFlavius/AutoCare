/** Operator-only lookup. Does not grant a role or choose a first registered user. */
import { eq } from 'drizzle-orm';
import { db, closeLocalDb } from '../src/lib/db';
import { user } from '../src/lib/schema';
const email = process.argv[2];
if (!email) throw new Error('Furnizează adresa exactă a contului Fondatorului existent.');
const found = (
  await db()
    .select({ id: user.id, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, email))
)[0];
if (!found?.emailVerified)
  throw new Error('Contul trebuie să existe și să aibă e-mailul confirmat.');
console.log('Configurează AUTOCARE_FOUNDER_USER_ID pe server cu ID-ul verificat:', found.id);
await closeLocalDb();
