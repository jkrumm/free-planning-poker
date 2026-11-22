CREATE INDEX "room_created_at_idx" ON "fpp"."room" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "round_revealed_at_idx" ON "fpp"."round" USING btree ("revealed_at");--> statement-breakpoint
CREATE INDEX "visitor_day_visitor_idx" ON "fpp"."visitor_day" USING btree ("visitor","day");