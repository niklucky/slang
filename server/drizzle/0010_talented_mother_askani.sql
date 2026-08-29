-- IRREVERSIBLE DATA LOSS — READ BEFORE APPLYING
--
-- This migration removes the channels feature. Translation rows that only
-- differ by channel are collapsed to one row per (word, locale): a live row
-- wins over a deleted one, then the newest updated_at, then the smallest id.
-- The losing rows are DELETED and cannot be recovered once this migration
-- has run.
--
-- Before deploying, take a backup or snapshot of the affected translations
-- (and of the channels table this migration drops), e.g.:
--
--   CREATE TABLE translations_channel_backup AS
--   SELECT t.*, c.name AS channel_name
--   FROM translations t
--   LEFT JOIN channels c ON c.id = t.channel_id
--   WHERE (t.word_id, t.locale_id) IN (
--     SELECT word_id, locale_id FROM translations
--     GROUP BY word_id, locale_id HAVING count(*) > 1
--   );
--
-- Pre-flight duplicate-impact count; rows_to_delete is 0 when this migration
-- changes no translation data:
--
--   SELECT
--     count(*) FILTER (WHERE total > 1) AS duplicate_pairs,
--     coalesce(sum(total - 1) FILTER (WHERE total > 1), 0) AS rows_to_delete
--   FROM (
--     SELECT count(*) AS total FROM translations GROUP BY word_id, locale_id
--   ) AS g;
--
-- The collapse below keeps the same keeper rules and reports the number of
-- deleted rows as a NOTICE while it runs.
DO $$
DECLARE
	"deleted_rows" bigint;
BEGIN
	WITH "doomed" AS (
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
		)
		RETURNING 1
	)
	SELECT count(*) INTO "deleted_rows" FROM "doomed";
	RAISE NOTICE 'migration 0010: collapsed channel duplicates, deleted % translation rows', "deleted_rows";
END $$;--> statement-breakpoint
ALTER TABLE "translations" DROP CONSTRAINT "translations_channel_id_channels_id_fk";--> statement-breakpoint
ALTER TABLE "translation_versions" DROP CONSTRAINT "translation_versions_channel_id_channels_id_fk";--> statement-breakpoint
DROP INDEX "translations_word_locale_channel_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "translations_word_locale_unique" ON "translations" USING btree ("word_id","locale_id") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "translations" DROP COLUMN "channel_id";--> statement-breakpoint
ALTER TABLE "translation_versions" DROP COLUMN "channel_id";--> statement-breakpoint
ALTER TABLE "channels" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "channels";
