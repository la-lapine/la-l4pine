import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { createCharacter, createFeedback, createMusicTrack, deleteCharacter, deleteFeedback, deleteMusicTrack, updateMusicTrack, ensureTag, createNotification, getSiteSettings, listAllCharacters, listNotifications, listFeedback, listMusicTracks, listPublicCharacters, listTags, toggleFavorite, updateCharacter, upsertSiteSetting, verifyCharacterPassword } from "./db";

const characterInput = z.object({
  slug: z.string().min(1).max(128),
  name: z.string().min(1).max(160),
  imageUrl: z.string().max(1000).optional().nullable(),
  caption: z.string().max(255).optional().nullable(),
  titleColor: z.string().max(32).optional().nullable(),
  bodyColor: z.string().max(32).optional().nullable(),
  colorSync: z.number().int().min(0).max(1).optional(),
  tagsJson: z.string().optional().nullable(),
  externalUrl: z.string().url().optional().or(z.literal("")).nullable(),
  accessTitle: z.string().max(180).optional().nullable(),
  sectionsJson: z.string().optional().nullable(),
  passwordHint: z.string().max(255).optional().nullable(),
  description: z.string().optional().nullable(),
  backstory: z.string().optional().nullable(),
  firstMessage: z.string().optional().nullable(),
  section: z.string().max(32).default("new"),
  featured: z.number().int().min(0).max(1).default(0),
  comingSoon: z.number().int().min(0).max(1).default(0),
  daily: z.number().int().min(0).max(1).default(0),
  password: z.string().max(255).optional(),
});

const adminOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new Error("Owner access required");
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  characters: router({
    list: publicProcedure.query(() => listPublicCharacters()),
    verifyAccess: publicProcedure.input(z.object({ id: z.number(), password: z.string() })).mutation(({ input }) => verifyCharacterPassword(input.id, input.password)),
    favorite: publicProcedure.input(z.object({ characterId: z.number(), visitorId: z.string().min(8).max(128) })).mutation(({ input }) => toggleFavorite(input.characterId, input.visitorId)),
    feedback: publicProcedure.input(z.object({ characterId: z.number(), authorName: z.string().max(80).default(""), message: z.string().min(2).max(2000) })).mutation(({ input }) => createFeedback(input.characterId, input.authorName, input.message)),
  }),
  tracks: router({
    list: publicProcedure.query(() => listMusicTracks()),
  }),
  notifications: router({
    list: publicProcedure.query(() => listNotifications()),
  }),
  settings: router({
    public: publicProcedure.query(() => getSiteSettings()),
    tags: publicProcedure.query(() => listTags()),
  }),
  owner: router({
    uploadAsset: adminOnlyProcedure.input(z.object({ filename: z.string().max(200), mimeType: z.string().max(120), data: z.string().max(15_000_000) })).mutation(async ({ input }) => { const base64 = input.data.replace(/^data:[^;]+;base64,/, ""); const safeFilename = input.filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "asset"; const result = await storagePut(`lalapine/${safeFilename}`, Buffer.from(base64, "base64"), input.mimeType); return { url: result.url, key: result.key }; }),
    unlock: publicProcedure.input(z.object({ password: z.string() })).mutation(({ input }) => ({ ok: input.password === (process.env.OWNER_ACCESS_PASSWORD || "jk0807") })),
    characters: adminOnlyProcedure.query(() => listAllCharacters()),
    createCharacter: adminOnlyProcedure.input(characterInput).mutation(({ input }) => createCharacter(input)),
    updateCharacter: adminOnlyProcedure.input(z.object({ id: z.number(), data: characterInput.partial() })).mutation(({ input }) => updateCharacter(input.id, input.data)),
    deleteCharacter: adminOnlyProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteCharacter(input.id)),
    feedback: adminOnlyProcedure.input(z.object({ characterId: z.number().optional() })).query(({ input }) => listFeedback(input.characterId)),
    deleteFeedback: adminOnlyProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteFeedback(input.id)),
    addTrack: adminOnlyProcedure.input(z.object({ title: z.string().min(1), artist: z.string().optional(), audioUrl: z.string().optional(), sortOrder: z.number().default(0) })).mutation(({ input }) => createMusicTrack(input)),
    updateTrack: adminOnlyProcedure.input(z.object({ id: z.number(), title: z.string().min(1), artist: z.string().optional().nullable(), audioUrl: z.string().optional().nullable() })).mutation(({ input }) => updateMusicTrack(input.id, { title: input.title, artist: input.artist || null, audioUrl: input.audioUrl || null })),
    deleteTrack: adminOnlyProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteMusicTrack(input.id)),
    addNotification: adminOnlyProcedure.input(z.object({ title: z.string().min(1).max(180), body: z.string().min(1).max(5000), publishedAt: z.string().optional(), pinned: z.boolean().default(false) })).mutation(({ input }) => createNotification(input)),
    saveSetting: adminOnlyProcedure.input(z.object({ settingKey: z.string().min(1), settingValue: z.string() })).mutation(({ input }) => upsertSiteSetting(input.settingKey, input.settingValue)),
    ensureTag: adminOnlyProcedure.input(z.object({ name: z.string().min(1) })).mutation(({ input }) => ensureTag(input.name)),
  }),
});

export type AppRouter = typeof appRouter;
