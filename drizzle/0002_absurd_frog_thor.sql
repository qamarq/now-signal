ALTER TABLE "event_clusters" ADD COLUMN IF NOT EXISTS "parent_cluster_id" uuid;--> statement-breakpoint
ALTER TABLE "event_clusters" ADD COLUMN IF NOT EXISTS "depth" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eventClusters_parentClusterId_idx" ON "event_clusters" USING btree ("parent_cluster_id");