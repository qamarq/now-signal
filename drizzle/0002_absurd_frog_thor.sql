ALTER TABLE "event_clusters" ADD COLUMN "parent_cluster_id" uuid;--> statement-breakpoint
ALTER TABLE "event_clusters" ADD COLUMN "depth" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "eventClusters_parentClusterId_idx" ON "event_clusters" USING btree ("parent_cluster_id");