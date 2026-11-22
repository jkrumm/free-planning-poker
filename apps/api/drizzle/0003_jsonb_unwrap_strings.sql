-- Rows written through Drizzle's jsonb column hold a JSON string (jsonb_typeof = 'string'); rewrite them to the array or object inside.
UPDATE "fpp"."round" SET "deck" = ("deck" #>> '{}')::jsonb WHERE jsonb_typeof("deck") = 'string';--> statement-breakpoint
UPDATE "fpp"."round" SET "distribution" = ("distribution" #>> '{}')::jsonb WHERE jsonb_typeof("distribution") = 'string';--> statement-breakpoint
UPDATE "fpp"."round" SET "summary" = ("summary" #>> '{}')::jsonb WHERE jsonb_typeof("summary") = 'string';--> statement-breakpoint
UPDATE "fpp"."room" SET "settings" = ("settings" #>> '{}')::jsonb WHERE jsonb_typeof("settings") = 'string';
