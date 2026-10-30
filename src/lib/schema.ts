import {sql} from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  index,
  uniqueIndex,
  foreignKey,
  unique,
} from 'drizzle-orm/pg-core';
export const user = pgTable('app_user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const session = pgTable('session', {
  id: text().primaryKey(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});
export const account = pgTable('account', {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  password: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const rateLimit = pgTable('rate_limit', {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: 'number' }).notNull(),
});
export const profiles = pgTable('profiles', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  timezone: text().notNull().default('Europe/Bucharest'),
  emailEnabled: boolean().notNull().default(true),
  pushEnabled: boolean().notNull().default(false),
  afterExpiry: boolean().notNull().default(false),
  offsets: jsonb().$type<number[]>().notNull().default([30, 7, 1, 0]),
  hour: integer().notNull().default(9),
  role: text().notNull().default('user'),
});
export const vehicles = pgTable(
  'vehicles',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    brand: text().notNull(),
    model: text().notNull(),
    year: integer().notNull(),
    plate: text().notNull(),
    vin: text(),
    engine: text(),
    fuel: text().notNull(),
    capacity: integer(),
    odometer: integer().notNull().default(0),
    purchasedAt: text(),
    notes: text(),
    archived: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('vehicle_owner').on(t.userId), unique('vehicle_owner_pair').on(t.id, t.userId)],
);
// SmartDrive history is independent of the vehicle's confirmed odometer.
export const mileageReadings = pgTable('mileage_readings', {
  id: text().primaryKey(),
  userId: text().notNull().references(() => user.id, { onDelete: 'cascade' }),
  vehicleId: text().notNull(),
  odometer: integer().notNull(),
  source: text().notNull().default('manual'),
  recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('mileage_readings_owner_vehicle').on(t.userId, t.vehicleId, t.recordedAt),
  foreignKey({ name: 'mileage_reading_owner_vehicle_fk', columns: [t.vehicleId, t.userId], foreignColumns: [vehicles.id, vehicles.userId] }).onDelete('cascade'),
]);

export const gpsTrips = pgTable('gps_trips', {
  id: text().primaryKey(),
  userId: text().notNull().references(() => user.id, { onDelete: 'cascade' }),
  vehicleId: text().notNull(),
  distanceMeters: integer().notNull(),
  durationSeconds: integer().notNull(),
  startedAt: timestamp({ withTimezone: true }).notNull(),
  endedAt: timestamp({ withTimezone: true }).notNull(),
  source: text().notNull().default('browser-gps'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('gps_trips_owner_vehicle').on(t.userId, t.vehicleId, t.startedAt),
  foreignKey({ name: 'gps_trip_owner_vehicle_fk', columns: [t.vehicleId, t.userId], foreignColumns: [vehicles.id, vehicles.userId] }).onDelete('cascade'),
]);

export const mileageReminderPreferences = pgTable('mileage_reminder_preferences', {
  userId: text().primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  frequencyDays: integer().notNull().default(3),
  enabled: boolean().notNull().default(true),
  lastSentAt: timestamp({ withTimezone: true }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const records = pgTable(
  'records',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    vehicleId: text()
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    category: text().notNull(),
    title: text().notNull(),
    date: text(),
    expiresAt: text(),
    nextKm: integer(),
    odometer: integer(),
    amountBani: integer().notNull().default(0),
    amountKnown: boolean().notNull().default(true),
    provider: text(),
    number: text(),
    notes: text(),
    parts: text(),
    cancelled: boolean().notNull().default(false),
    revision: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('record_owner').on(t.userId)],
);
export const files = pgTable('files', {
  id: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  recordId: text()
    .notNull()
    .references(() => records.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  mime: text().notNull(),
  data: text().notNull(),
  size: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const subscriptions = pgTable('subscriptions', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  customerId: text().unique(),
  subscriptionId: text().unique(),
  refundedInvoiceId: text(),
  status: text().notNull().default('free'),
  periodEnd: timestamp({ withTimezone: true }),
  cancelAtPeriodEnd: boolean().notNull().default(false),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const notifications = pgTable(
  'notifications',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recordId: text()
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    revision: integer().notNull(),
    channel: text().notNull(),
    offset: text().notNull(),
    localDate: text().notNull(),
    status: text().notNull().default('pending'),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp({ withTimezone: true }),
    message: text().notNull(),
    error: text(),
    providerId: text(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('notification_dedupe').on(t.recordId, t.revision, t.channel, t.offset),
    index('notification_queue').on(t.status, t.nextAttemptAt),
  ],
);
export const pushes = pgTable('pushes', {
  id: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  endpoint: text().notNull().unique(),
  keys: jsonb().$type<{ p256dh: string; auth: string }>().notNull(),
});
export const webhookEvents = pgTable('webhook_events', {
  id: text().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const jobRuns = pgTable('job_runs', {
  id: text().primaryKey(),
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
  status: text().notNull(),
  queued: integer().default(0),
  sent: integer().default(0),
});
export const support = pgTable('support', {
  id: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  message: text().notNull(),
  status: text().notNull().default('open'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const settings = pgTable('settings', { key: text().primaryKey(), value: jsonb().notNull() });
export const invoices = pgTable('invoices', {
  livemode: boolean().notNull().default(false),
  id: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  amountBani: integer().notNull(),
  currency: text().notNull(),
  status: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const recordHistory = pgTable('record_history', {
  id: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  recordId: text()
    .notNull()
    .references(() => records.id, { onDelete: 'cascade' }),
  snapshot: jsonb().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const deliveryAttempts = pgTable('delivery_attempts', {
  id: text().primaryKey(),
  notificationId: text()
    .notNull()
    .references(() => notifications.id, { onDelete: 'cascade' }),
  status: text().notNull(),
  error: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const audit = pgTable('audit', {
  id: text().primaryKey(),
  actorId: text().references(() => user.id, { onDelete: 'set null' }),
  action: text().notNull(),
  target: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const requestLimits = pgTable('request_limits', {
  key: text().primaryKey(),
  count: integer().notNull().default(1),
  window: timestamp({ withTimezone: true }).notNull(),
});

export const emailEvents = pgTable(
  'email_events',
  {
    id: text().primaryKey(),
    providerId: text().notNull(),
    status: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('email_event_provider').on(t.providerId)],
);
export const vehiclePhotos = pgTable('vehicle_photos', {
  vehicleId: text()
    .primaryKey()
    .references(() => vehicles.id, { onDelete: 'cascade' }),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  mime: text().notNull(),
  data: text().notNull(),
  size: integer().notNull(),
});

export const supportThreads = pgTable(
  'support_threads',
  {
    assignedTo: text().references(() => user.id, { onDelete: 'set null' }),
    workingAt: timestamp({ withTimezone: true }),
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    status: text().notNull().default('open'),
    completedAt: timestamp({ withTimezone: true }),
    trashedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_thread_owner').on(t.userId), index('support_thread_status').on(t.status)],
);
export const supportChatMessages = pgTable(
  'support_chat_messages',
  {
    id: text().primaryKey(),
    threadId: text()
      .notNull()
      .references(() => supportThreads.id, { onDelete: 'cascade' }),
    authorId: text().references(() => user.id, { onDelete: 'set null' }),
    authorName: text().notNull(),
    authorRole: text().notNull(),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_message_thread').on(t.threadId, t.createdAt)],
);
export const supportParticipants = pgTable(
  'support_participants',
  {
    threadId: text()
      .notNull()
      .references(() => supportThreads.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('support_participant_unique').on(t.threadId, t.userId)],
);

export const premiumGrants = pgTable(
  'premium_grants',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    grantedBy: text().references(() => user.id, { onDelete: 'set null' }),
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    revokedBy: text().references(() => user.id, { onDelete: 'set null' }),
    note: text().notNull().default(''),
  },
  (t) => [index('premium_grant_owner').on(t.userId)],
);
export const accountRestrictions = pgTable('account_restrictions', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  suspendedAt: timestamp({ withTimezone: true }),
  reason: text().notNull().default(''),
  updatedBy: text().references(() => user.id, { onDelete: 'set null' }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const billingPrices = pgTable('billing_prices', {
  id: text().primaryKey(),
  interval: text().notNull(),
  amountBani: integer().notNull(),
  currency: text().notNull().default('ron'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const supportReads = pgTable(
  'support_reads',
  {
    threadId: text()
      .notNull()
      .references(() => supportThreads.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('support_reads_unique').on(t.threadId, t.userId)],
);
export const supportChatFiles = pgTable(
  'support_chat_files',
  {
    id: text().primaryKey(),
    threadId: text()
      .notNull()
      .references(() => supportThreads.id, { onDelete: 'cascade' }),
    messageId: text()
      .notNull()
      .references(() => supportChatMessages.id, { onDelete: 'cascade' }),
    authorId: text().references(() => user.id, { onDelete: 'set null' }),
    name: text().notNull(),
    mime: text().notNull(),
    data: text().notNull(),
    size: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_files_thread').on(t.threadId)],
);

export const supportMessages = pgTable(
  'support_messages',
  {
    id: text().primaryKey(),
    threadId: text()
      .notNull()
      .references(() => support.id, { onDelete: 'cascade' }),
    authorId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    authorRole: text().notNull().default('user'),
    message: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_messages_thread').on(t.threadId, t.createdAt, t.id)],
);

export const communicationPreferences = pgTable('communication_preferences', {
  userId: text().primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  transactional: boolean().notNull().default(true),
  promotional: boolean().notNull().default(false),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const mailCampaigns = pgTable('mail_campaigns', {
  id: text().primaryKey(),
  actorId: text().references(() => user.id, { onDelete: 'set null' }),
  source: text().notNull().default('manual'),
  template: text().notNull(),
  category: text().notNull(),
  subject: text().notNull(),
  message: text().notNull(),
  ctaLabel: text().notNull(),
  ctaPath: text().notNull(),
  fingerprint: text().notNull(),
  status: text().notNull().default('draft'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [index('mail_campaigns_created').on(t.createdAt)]);
export const mailDeliveries = pgTable('mail_deliveries', {
  id: text().primaryKey(),
  campaignId: text().notNull().references(() => mailCampaigns.id, { onDelete: 'cascade' }),
  userId: text().notNull().references(() => user.id, { onDelete: 'cascade' }),
  dedupeKey: text().notNull().unique(),
  recipientEmail: text(),
  status: text().notNull().default('draft'),
  error: text(),
  providerId: text(),
  context: jsonb().$type<{ subscriptionId?: string; periodEnd?: string; invoiceId?: string; grantId?: string }>().notNull().default({}),
  attemptedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [index('mail_delivery_campaign_status').on(t.campaignId,t.status), index('mail_delivery_provider').on(t.providerId)]);

export const mechanicShares=pgTable('mechanic_shares',{
 id:text().primaryKey(),userId:text().notNull().references(()=>user.id,{onDelete:'cascade'}),
 tokenHash:text().notNull().unique(),snapshot:jsonb().notNull(),fileIds:jsonb().$type<string[]>().notNull(),
 expiresAt:timestamp({withTimezone:true}).notNull(),revoked:boolean().notNull().default(false),createdAt:timestamp({withTimezone:true}).notNull().defaultNow(),
},t=>[index('mechanic_share_owner').on(t.userId)]);

export const subscriptionExtensions=pgTable('subscription_extensions',{
 id:text().primaryKey(),userId:text().notNull().references(()=>user.id,{onDelete:'cascade'}),sessionId:text().notNull().unique(),paymentIntent:text(),months:integer().notNull(),amountBani:integer().notNull(),status:text().notNull().default('pending'),startsAt:timestamp({withTimezone:true}),endsAt:timestamp({withTimezone:true}),createdAt:timestamp({withTimezone:true}).notNull().defaultNow(),
},t=>[index('subscription_extension_owner').on(t.userId),uniqueIndex('subscription_extension_pending').on(t.userId).where(sql`${t.status} IN ('pending','processing')`)]);
