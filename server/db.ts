import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { InsertUser, users, characters, feedback, favorites, musicTracks, siteSettings, tags, Character } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (['name', 'email', 'loginMethod'] as const).forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const publicCharacterColumns = {
  id: characters.id,
  slug: characters.slug,
  name: characters.name,
  imageUrl: characters.imageUrl,
  caption: characters.caption,
  titleColor: characters.titleColor,
  bodyColor: characters.bodyColor,
  colorSync: characters.colorSync,
  tagsJson: characters.tagsJson,
  externalUrl: characters.externalUrl,
  accessTitle: characters.accessTitle,
  sectionsJson: characters.sectionsJson,
  passwordProtected: characters.passwordProtected,
  passwordHint: characters.passwordHint,
  description: characters.description,
  backstory: characters.backstory,
  firstMessage: characters.firstMessage,
  section: characters.section,
  featured: characters.featured,
  comingSoon: characters.comingSoon,
  daily: characters.daily,
  favoriteCount: characters.favoriteCount,
  createdAt: characters.createdAt,
  updatedAt: characters.updatedAt,
};

export async function listPublicCharacters() {
  const db = await getDb();
  if (!db) return [];
  return db.select(publicCharacterColumns).from(characters).orderBy(desc(characters.createdAt));
}

export async function listAllCharacters() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(characters).orderBy(desc(characters.createdAt));
}

export async function createCharacter(input: Omit<typeof characters.$inferInsert, "passwordHash"> & { password?: string }) {
  const db = await getDb();
  if (!db) return null;
  const { password, ...rest } = input;
  const passwordHash = password ? hashCharacterPassword(password) : null;
  const inserted = await db.insert(characters).values({ ...rest, passwordHash, passwordProtected: password ? 1 : 0 });
  if (typeof rest.tagsJson === "string") await syncCharacterTags(rest.tagsJson);
  return inserted[0]?.insertId ?? null;
}

export async function updateCharacter(id: number, input: Partial<Omit<typeof characters.$inferInsert, "passwordHash">> & { password?: string }) {
  const db = await getDb();
  if (!db) return;
  const { password, ...rest } = input;
  const update: Record<string, unknown> = { ...rest };
  if (password !== undefined) {
    update.passwordHash = password ? hashCharacterPassword(password) : null;
    update.passwordProtected = password ? 1 : 0;
  }
  await db.update(characters).set(update).where(eq(characters.id, id));
  if (typeof rest.tagsJson === "string") await syncCharacterTags(rest.tagsJson);
}

async function syncCharacterTags(raw: string) {
  let names: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    names = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    names = raw.split(",").map(tag => tag.trim());
  }
  await Promise.all(Array.from(new Set(names.map(name => name.trim()).filter(Boolean))).map(name => ensureTag(name)));
}

export async function deleteCharacter(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(characters).where(eq(characters.id, id));
}

export function hashCharacterPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function checkCharacterPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
}

export async function verifyCharacterPassword(id: number, password: string) {
  const db = await getDb();
  if (!db) return { ok: false as const, url: null };
  const result = await db.select({ externalUrl: characters.externalUrl, passwordHash: characters.passwordHash, passwordProtected: characters.passwordProtected }).from(characters).where(eq(characters.id, id)).limit(1);
  const character = result[0];
  if (!character?.externalUrl) return { ok: false as const, url: null };
  if (!character.passwordProtected) return { ok: true as const, url: character.externalUrl };
  return { ok: Boolean(character.passwordHash && checkCharacterPassword(password, character.passwordHash)), url: character.passwordHash && checkCharacterPassword(password, character.passwordHash) ? character.externalUrl : null };
}

export async function createFeedback(characterId: number, authorName: string, message: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(feedback).values({ characterId, authorName: authorName || "Một người ghé thăm", message: message.trim() });
  return result[0]?.insertId ?? null;
}

export async function listFeedback(characterId?: number) {
  const db = await getDb();
  if (!db) return [];
  return characterId ? db.select().from(feedback).where(eq(feedback.characterId, characterId)).orderBy(desc(feedback.createdAt)) : db.select().from(feedback).orderBy(desc(feedback.createdAt));
}

export async function deleteFeedback(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(feedback).where(eq(feedback.id, id));
}

export async function toggleFavorite(characterId: number, visitorId: string) {
  const db = await getDb();
  if (!db) return { favorited: false, count: 0 };
  const existing = await db.select().from(favorites).where(and(eq(favorites.characterId, characterId), eq(favorites.visitorId, visitorId))).limit(1);
  if (existing[0]) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    await db.update(characters).set({ favoriteCount: sql`${characters.favoriteCount} - 1` }).where(eq(characters.id, characterId));
  } else {
    await db.insert(favorites).values({ characterId, visitorId });
    await db.update(characters).set({ favoriteCount: sql`${characters.favoriteCount} + 1` }).where(eq(characters.id, characterId));
  }
  const current = await db.select({ count: characters.favoriteCount }).from(characters).where(eq(characters.id, characterId)).limit(1);
  return { favorited: !existing[0], count: current[0]?.count ?? 0 };
}

export async function listMusicTracks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(musicTracks).orderBy(musicTracks.sortOrder);
}

export async function createMusicTrack(input: typeof musicTracks.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(musicTracks).values(input);
  return result[0]?.insertId ?? null;
}

export async function updateMusicTrack(id: number, input: Partial<typeof musicTracks.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(musicTracks).set(input).where(eq(musicTracks.id, id));
}

export async function deleteMusicTrack(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(musicTracks).where(eq(musicTracks.id, id));
}

type StoredNotification = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  pinned: boolean;
  createdAt: string;
};

const notificationsSettingKey = "broadcast_notifications";

function parseNotifications(value?: string | null): StoredNotification[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.body === "string") : [];
  } catch {
    return [];
  }
}

export async function listNotifications() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ settingValue: siteSettings.settingValue }).from(siteSettings).where(eq(siteSettings.settingKey, notificationsSettingKey)).limit(1);
  const now = Date.now();
  return parseNotifications(result[0]?.settingValue).filter((item) => !item.publishedAt || new Date(item.publishedAt).getTime() <= now).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
}

export async function createNotification(input: { title: string; body: string; publishedAt?: string; pinned?: boolean }) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select({ settingValue: siteSettings.settingValue }).from(siteSettings).where(eq(siteSettings.settingKey, notificationsSettingKey)).limit(1);
  const now = new Date().toISOString();
  const notification: StoredNotification = { id: `${Date.now()}-${randomBytes(5).toString("hex")}`, title: input.title.trim(), body: input.body.trim(), publishedAt: input.publishedAt || now, pinned: Boolean(input.pinned), createdAt: now };
  const next = [...parseNotifications(existing[0]?.settingValue), notification].slice(-100);
  await upsertSiteSetting(notificationsSettingKey, JSON.stringify(next));
  return notification;
}

export async function getSiteSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(siteSettings);
}

export async function upsertSiteSetting(settingKey: string, settingValue: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(siteSettings).values({ settingKey, settingValue }).onDuplicateKeyUpdate({ set: { settingValue } });
}

export async function ensureTag(name: string) {
  const db = await getDb();
  if (!db) return null;
  const normalized = name.trim();
  if (!normalized) return null;
  const slug = createHash("sha1").update(normalized.toLowerCase()).digest("hex").slice(0, 12);
  await db.insert(tags).values({ name: normalized, slug }).onDuplicateKeyUpdate({ set: { name: normalized } });
  const result = await db.select().from(tags).where(eq(tags.name, normalized)).limit(1);
  return result[0];
}

export async function listTags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tags).orderBy(tags.name);
}
