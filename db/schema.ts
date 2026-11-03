import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const officials = sqliteTable("officials", {
  id: text("id").primaryKey(),
  profileId: text("profile_id"),
  name: text("name").notNull(),
  city: text("city").notNull().default(""),
  county: text("county").notNull().default(""),
  role: text("role").notNull(),
  league: text("league").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("officials_name_idx").on(table.name),
  index("officials_county_idx").on(table.county),
]);

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  competition: text("competition").notNull(),
  round: text("round").notNull().default(""),
  home: text("home").notNull(),
  away: text("away").notNull(),
  stadium: text("stadium").notNull().default(""),
  city: text("city").notNull().default(""),
  county: text("county").notNull().default(""),
  countyCode: text("county_code").notNull().default(""),
  status: text("status").notNull().default(""),
  score: text("score"),
  delegatesJson: text("delegates_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("matches_date_idx").on(table.date),
  index("matches_competition_idx").on(table.competition),
  index("matches_county_idx").on(table.county),
]);

export const notices = sqliteTable("notices", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull().default(""),
  url: text("url").notNull(),
  attachment: text("attachment"),
  updatedAt: text("updated_at").notNull(),
});

export const profiles = sqliteTable("profiles", {
  profileId: text("profile_id").primaryKey(),
  payloadJson: text("payload_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const syncState = sqliteTable("sync_state", {
  scope: text("scope").primaryKey(),
  syncedAt: text("synced_at").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull().default(""),
});
