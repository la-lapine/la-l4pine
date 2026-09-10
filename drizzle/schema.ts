import { int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const characters = mysqlTable("characters", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  imageUrl: text("imageUrl"),
  caption: varchar("caption", { length: 255 }),
  titleColor: varchar("titleColor", { length: 32 }),
  bodyColor: varchar("bodyColor", { length: 32 }),
  colorSync: int("colorSync").default(1).notNull(),
  tagsJson: text("tagsJson"),
  externalUrl: text("externalUrl"),
  accessTitle: varchar("accessTitle", { length: 180 }),
  sectionsJson: text("sectionsJson"),
  passwordProtected: int("passwordProtected").default(0).notNull(),
  passwordHash: text("passwordHash"),
  passwordHint: varchar("passwordHint", { length: 255 }),
  description: text("description"),
  backstory: text("backstory"),
  firstMessage: text("firstMessage"),
  section: varchar("section", { length: 32 }).default("new").notNull(),
  featured: int("featured").default(0).notNull(),
  comingSoon: int("comingSoon").default(0).notNull(),
  daily: int("daily").default(0).notNull(),
  favoriteCount: int("favoriteCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const feedback = mysqlTable("feedback", {
  id: int("id").autoincrement().primaryKey(),
  characterId: int("characterId").notNull(),
  authorName: varchar("authorName", { length: 80 }),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  characterId: int("characterId").notNull(),
  visitorId: varchar("visitorId", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const musicTracks = mysqlTable("musicTracks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  artist: varchar("artist", { length: 160 }),
  audioUrl: text("audioUrl"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const siteSettings = mysqlTable("siteSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 120 }).notNull().unique(),
  settingValue: text("settingValue"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type InsertCharacter = typeof characters.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type MusicTrack = typeof musicTracks.$inferSelect;
