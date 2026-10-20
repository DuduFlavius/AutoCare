import { z } from 'zod';
const text = z.string().trim().max(250);
const note = z.string().trim().max(4000).optional().nullable();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) => !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    'Dată invalidă',
  );
export const vehicleInput = z.object({
  brand: text.min(1),
  model: text.min(1),
  year: z
    .number()
    .int()
    .min(1886)
    .max(new Date().getFullYear() + 1),
  plate: text
    .min(2)
    .max(20)
    .transform((x) => x.toUpperCase()),
  vin: text.max(17).optional().nullable(),
  engine: text.optional().nullable(),
  fuel: text.min(1),
  capacity: z.number().int().min(0).max(30000).optional().nullable(),
  odometer: z.number().int().min(0).max(10000000),
  purchasedAt: date.optional().nullable(),
  notes: note,
});
export const recordInput = z
  .object({
    vehicleId: z.string().uuid(),
    kind: z.enum(['document', 'service', 'expense']),
    category: text.min(1),
    title: text.min(1),
    date: date.optional().nullable(),
    expiresAt: date.optional().nullable(),
    nextKm: z.number().int().min(0).optional().nullable(),
    odometer: z.number().int().min(0).optional().nullable(),
    amountBani: z.number().int().min(0).max(100000000).default(0),
    amountKnown: z.boolean().default(true),
    provider: text.optional().nullable(),
    number: text.optional().nullable(),
    notes: note,
    parts: note,
  })
  .superRefine((r, ctx) => {
    if (r.kind === 'document' && r.date && r.expiresAt && r.expiresAt < r.date)
      ctx.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Expirarea trebuie să fie după emitere.',
      });
  });
export const profileInput = z
  .object({
    timezone: z.string().refine((s) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: s });
        return true;
      } catch {
        return false;
      }
    }),
    emailEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    afterExpiry: z.boolean(),
    offsets: z
      .array(
        z
          .number()
          .int()
          .refine((n) => [30, 14, 7, 6, 5, 4, 3, 2, 1, 0].includes(n)),
      )
      .max(10)
      .transform((x) => [...new Set(x)]),
    hour: z.number().int().min(0).max(23),
  })
  .strict();
