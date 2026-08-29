-- Rows that only differ by channel collapse into one row per (word, locale):
-- a live row wins over a deleted one, then the newest updated_at, then the
-- smallest id. Keeps at most one row per pair so restores stay conflict-free.
DELETE FROM "translations" AS "t"
WHERE EXISTS (
	SELECT 1 FROM "translations" AS "keeper"
	WHERE "keeper"."word_id" = "t"."word_id"
		AND "keeper"."locale_id" = "t"."locale_id"
		AND "keeper"."id" <> "t"."id"
		AND (
			("keeper"."deleted_at" IS NULL AND "t"."deleted_at" IS NOT NULL)
			OR (
				("keeper"."deleted_at" IS NULL) = ("t"."deleted_at" IS NULL)
				AND (
					"keeper"."updated_at" > "t"."updated_at"
					OR ("keeper"."updated_at" = "t"."updated_at" AND "keeper"."id" < "t"."id")
				)
			)
		)
);--> statement-breakpoint
ALTER TABLE "translations" DROP CONSTRAINT "translations_channel_id_channels_id_fk";--> statement-breakpoint
ALTER TABLE "translation_versions" DROP CONSTRAINT "translation_versions_channel_id_channels_id_fk";--> statement-breakpoint
DROP INDEX "translations_word_locale_channel_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "translations_word_locale_unique" ON "translations" USING btree ("word_id","locale_id") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "translations" DROP COLUMN "channel_id";--> statement-breakpoint
ALTER TABLE "translation_versions" DROP COLUMN "channel_id";--> statement-breakpoint
ALTER TABLE "channels" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "channels";
