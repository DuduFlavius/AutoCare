import { eq, like } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isFounder, effectiveRole } from './permissions';
import { AppError, profile } from './service';
import { audit, settings } from './schema';

const key = 'support:availability';
const presence = 'support:presence:';
export const states = ['available', 'busy', 'offline', 'break', 'after_hours', 'maintenance'] as const;
export type SupportState = typeof states[number];
export const defaultSupportMessages = {
  available: { ro: 'Am primit mesajul. Un coleg disponibil va prelua solicitarea.', en: 'We received your message. An available team member will review your request.' },
  busy: { ro: 'Am primit mesajul. Echipa răspunde în alte conversații și va reveni aici cât mai curând.', en: 'We received your message. Our team is assisting other customers and will reply here as soon as possible.' },
  offline: { ro: 'Am primit mesajul. Echipa nu este conectată acum. Îți vom răspunde aici când revenim.', en: 'We received your message. Our team is offline right now and will reply here when back.' },
  break: { ro: 'Am primit mesajul. Echipa este în pauză și va reveni la solicitarea ta după pauză.', en: 'We received your message. Our team is on a break and will review your request afterward.' },
  after_hours: { ro: 'Am primit mesajul în afara programului. Revenim în timpul programului de suport.', en: 'We received your message outside support hours. We will reply during operating hours.' },
  maintenance: { ro: 'Suportul este în mentenanță. Am înregistrat mesajul și vom reveni când serviciul este disponibil.', en: 'Support is undergoing maintenance. We received your message and will reply when the service is available.' },
};
const message = z.object({ ro: z.string().trim().min(1).max(600), en: z.string().trim().min(1).max(600) }).strict();
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const configSchema = z.object({
  mode: z.enum(['auto', 'offline', 'break', 'maintenance']),
  hours: z.object({ days: z.array(z.number().int().min(1).max(7)).min(1).max(7), start: clock, end: clock }).refine(h => h.start < h.end).nullable(),
  messages: z.object({ available: message, busy: message, offline: message, break: message, after_hours: message, maintenance: message }).strict(),
}).strict();
const fallback: z.infer<typeof configSchema> = { mode: 'auto', hours: null, messages: defaultSupportMessages };
async function config() {
  const [row] = await db().select({ value: settings.value }).from(settings).where(eq(settings.key, key));
  const parsed = configSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : fallback;
}
export function resolveSupportState(options: { mode: typeof fallback.mode; hours: typeof fallback.hours; operators: boolean[] }, now = new Date()): SupportState {
  if (options.mode !== 'auto') return options.mode;
  if (options.hours) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
    const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(part('weekday')) + 1;
    const time = part('hour') + ':' + part('minute');
    if (!options.hours.days.includes(day) || time < options.hours.start || time >= options.hours.end) return 'after_hours';
  }
  return options.operators.includes(false) ? 'available' : options.operators.length ? 'busy' : 'offline';
}

export async function supportAvailability(now = new Date()) {
  const [prefs, heartbeats] = await Promise.all([
    config(),
    db().select({ key: settings.key, value: settings.value }).from(settings).where(like(settings.key, presence + '%')),
  ]);
  const operators = heartbeats.flatMap(row => {
    const value = row.value as { at?: number; busy?: boolean } | null;
    return value && typeof value.at === 'number' && now.getTime() - value.at >= 0 && now.getTime() - value.at < 55000
      && typeof value.busy === 'boolean' ? [value.busy] : [];
  });
  const state = resolveSupportState({ ...prefs, operators }, now);
  return { state, message: prefs.messages[state] };
}

export async function updateSupportPresence(uid: string, input: unknown) {
  const role = effectiveRole(uid, (await profile(uid)).role);
  if (!['founder', 'superadmin', 'admin', 'assistant'].includes(role)) throw new AppError(403, 'Acces rezervat echipei.');
  const { busy } = z.object({ busy: z.boolean() }).strict().parse(input);
  const value = { at: Date.now(), busy };
  await db().insert(settings).values({ key: presence + uid, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  return { ok: true };
}

export async function supportAvailabilitySettings(uid: string, input?: unknown) {
  if (!isFounder(uid)) throw new AppError(403, 'Acces rezervat fondatorului.');
  if (input === undefined) return config();
  const value = configSchema.parse(input);
  await db().transaction(async tx => {
    await tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
    await tx.insert(audit).values({ id: crypto.randomUUID(), actorId:uid, action:'support.availability.updated', target: key });
  });
  return value;
}
