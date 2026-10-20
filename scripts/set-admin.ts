import { eq } from 'drizzle-orm';
import { db, closeLocalDb } from '../src/lib/db';
import { user, profiles, audit } from '../src/lib/schema';
async function main() {
  const email = process.argv[2];
  if (!email) throw new Error('Supply the verified account email.');
  const u = (await db().select().from(user).where(eq(user.email, email)))[0];
  if (!u?.emailVerified) throw new Error('Account must exist and have verified email.');
  await db().transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId: u.id, role: 'admin' })
      .onConflictDoUpdate({ target: profiles.userId, set: { role: 'admin' } });
    await tx.insert(audit).values({
      id: crypto.randomUUID(),
      actorId: u.id,
      action: 'admin.granted.operator_cli',
      target: u.id,
    });
  });
  console.log('Administrator role granted to the selected verified account.');
  await closeLocalDb();
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Could not grant role');
  process.exit(1);
});
