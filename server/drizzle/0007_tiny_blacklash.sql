CREATE TABLE "word_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"word_id" integer NOT NULL,
	"action" text NOT NULL,
	"changed_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "word_versions" ADD CONSTRAINT "word_versions_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_versions" ADD CONSTRAINT "word_versions_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;