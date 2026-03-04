CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cluster_signals" (
	"cluster_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	CONSTRAINT "cluster_signals_cluster_id_signal_id_pk" PRIMARY KEY("cluster_id","signal_id")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"fcm_token" text NOT NULL,
	"platform" text DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_fcm_token_unique" UNIQUE("fcm_token")
);
--> statement-breakpoint
CREATE TABLE "event_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_key" text NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"category" text NOT NULL,
	"regions" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'early' NOT NULL,
	"confidence" smallint DEFAULT 0 NOT NULL,
	"early_score" smallint DEFAULT 0 NOT NULL,
	"confirm_score" smallint DEFAULT 0 NOT NULL,
	"hypothesis" text,
	"evidence" jsonb,
	"last_notified_status" text,
	"last_notified_at" timestamp with time zone,
	"ttl_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_clusters_cluster_key_unique" UNIQUE("cluster_key")
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"cluster_id" uuid NOT NULL,
	"type" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text NOT NULL,
	CONSTRAINT "notification_log_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"lang" text,
	"entities" jsonb,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signals_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"regions" text[] DEFAULT '{}' NOT NULL,
	"sensitivity" text DEFAULT 'med' NOT NULL,
	"early_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" smallint,
	"quiet_hours_end" smallint,
	"max_push_per_day" smallint DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cluster_signals" ADD CONSTRAINT "cluster_signals_cluster_id_event_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."event_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cluster_signals" ADD CONSTRAINT "cluster_signals_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_cluster_id_event_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."event_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clusterSignals_clusterId_idx" ON "cluster_signals" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "clusterSignals_signalId_idx" ON "cluster_signals" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "devices_userId_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "eventClusters_status_idx" ON "event_clusters" USING btree ("status");--> statement-breakpoint
CREATE INDEX "eventClusters_lastSeen_idx" ON "event_clusters" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "eventClusters_category_idx" ON "event_clusters" USING btree ("category");--> statement-breakpoint
CREATE INDEX "notificationLog_userId_idx" ON "notification_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notificationLog_clusterId_idx" ON "notification_log" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "notificationLog_sentAt_idx" ON "notification_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "signals_publishedAt_idx" ON "signals" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "signals_source_idx" ON "signals" USING btree ("source");--> statement-breakpoint
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");