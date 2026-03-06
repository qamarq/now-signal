import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uuid,
  smallint,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ============== Auth tables (Better Auth) ==============
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// ============== Now Signal tables ==============

// Subscriptions - user preferences for notifications
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
      .unique(),
    categories: text('categories').array().notNull().default([]),
    regions: text('regions').array().notNull().default([]),
    sensitivity: text('sensitivity').notNull().default('med'), // low | med | high
    earlyEnabled: boolean('early_enabled').notNull().default(false),
    quietHoursStart: smallint('quiet_hours_start'), // 0-23 hour
    quietHoursEnd: smallint('quiet_hours_end'), // 0-23 hour
    maxPushPerDay: smallint('max_push_per_day').notNull().default(10),
    discordWebhook: text('discord_webhook'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('subscriptions_userId_idx').on(table.userId)],
);

// Devices - FCM tokens for push notifications
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    fcmToken: text('fcm_token').notNull().unique(),
    platform: text('platform').notNull().default('web'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeen: timestamp('last_seen', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('devices_userId_idx').on(table.userId)],
);

// Signals - raw data from RSS/mock sources
export const signals = pgTable(
  'signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(), // rss | mock
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    lang: text('lang'),
    entities: jsonb('entities').$type<{
      regions?: string[];
      keywords?: string[];
      category?: string;
    }>(),
    hash: text('hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('signals_publishedAt_idx').on(table.publishedAt),
    index('signals_source_idx').on(table.source),
  ],
);

// Event Clusters - grouped signals representing events
export const eventClusters = pgTable(
  'event_clusters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clusterKey: text('cluster_key').notNull().unique(),
    parentClusterId: uuid('parent_cluster_id'),
    depth: smallint('depth').notNull().default(0),
    firstSeen: timestamp('first_seen', { withTimezone: true }).notNull(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull(),
    category: text('category').notNull(),
    regions: text('regions').array().notNull().default([]),
    status: text('status').notNull().default('early'), // early | watch | confirmed
    confidence: smallint('confidence').notNull().default(0),
    earlyScore: smallint('early_score').notNull().default(0),
    confirmScore: smallint('confirm_score').notNull().default(0),
    hypothesis: text('hypothesis'), // Short description of the event
    evidence: jsonb('evidence').$type<{
      sources: string[];
      signalCount: number;
      uniqueDomains: string[];
      keywords: string[];
    }>(),
    lastNotifiedStatus: text('last_notified_status'),
    lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),
    ttlExpiresAt: timestamp('ttl_expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('eventClusters_status_idx').on(table.status),
    index('eventClusters_lastSeen_idx').on(table.lastSeen),
    index('eventClusters_category_idx').on(table.category),
    index('eventClusters_parentClusterId_idx').on(table.parentClusterId),
  ],
);

// Cluster-Signal relation (many-to-many)
export const clusterSignals = pgTable(
  'cluster_signals',
  {
    clusterId: uuid('cluster_id')
      .notNull()
      .references(() => eventClusters.id, { onDelete: 'cascade' }),
    signalId: uuid('signal_id')
      .notNull()
      .references(() => signals.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.clusterId, table.signalId] }),
    index('clusterSignals_clusterId_idx').on(table.clusterId),
    index('clusterSignals_signalId_idx').on(table.signalId),
  ],
);

// Notification Log - for deduplication and history
export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    clusterId: uuid('cluster_id')
      .notNull()
      .references(() => eventClusters.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // early | confirmed | major_update
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    dedupeKey: text('dedupe_key').notNull().unique(),
  },
  (table) => [
    index('notificationLog_userId_idx').on(table.userId),
    index('notificationLog_clusterId_idx').on(table.clusterId),
    index('notificationLog_sentAt_idx').on(table.sentAt),
  ],
);

// ============== Relations ==============

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  subscription: one(subscriptions),
  devices: many(devices),
  notificationLogs: many(notificationLog),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(user, {
    fields: [subscriptions.userId],
    references: [user.id],
  }),
}));

export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(user, {
    fields: [devices.userId],
    references: [user.id],
  }),
}));

export const signalsRelations = relations(signals, ({ many }) => ({
  clusterSignals: many(clusterSignals),
}));

export const eventClustersRelations = relations(eventClusters, ({ many }) => ({
  clusterSignals: many(clusterSignals),
  notificationLogs: many(notificationLog),
}));

export const clusterSignalsRelations = relations(clusterSignals, ({ one }) => ({
  cluster: one(eventClusters, {
    fields: [clusterSignals.clusterId],
    references: [eventClusters.id],
  }),
  signal: one(signals, {
    fields: [clusterSignals.signalId],
    references: [signals.id],
  }),
}));

export const notificationLogRelations = relations(
  notificationLog,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationLog.userId],
      references: [user.id],
    }),
    cluster: one(eventClusters, {
      fields: [notificationLog.clusterId],
      references: [eventClusters.id],
    }),
  }),
);
