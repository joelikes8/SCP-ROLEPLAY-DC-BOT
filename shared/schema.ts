import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// For storing Discord user information
export const discordUsers = pgTable("discord_users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  discordUsername: text("discord_username").notNull(),
  discordGuildId: text("discord_guild_id").notNull(),
  isVerified: boolean("is_verified").default(false),
  // Null if not verified
  robloxId: text("roblox_id"),
  robloxUsername: text("roblox_username"),
  verificationCode: text("verification_code"),
  verifiedAt: timestamp("verified_at"),
});

// For storing patrol sessions
export const patrolSessions = pgTable("patrol_sessions", {
  id: serial("id").primaryKey(),
  discordUserId: text("discord_user_id").notNull(),
  discordGuildId: text("discord_guild_id").notNull(),
  // Status: "on_duty", "paused", "off_duty"
  status: text("status").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  totalDurationSeconds: integer("total_duration_seconds"),
  // For paused sessions - store cumulative active time before pausing
  activeDurationSeconds: integer("active_duration_seconds").default(0),
  // To track the time when the session was last paused
  lastPausedAt: timestamp("last_paused_at"),
});

// For storing verification attempts
export const verificationAttempts = pgTable("verification_attempts", {
  id: serial("id").primaryKey(),
  discordUserId: text("discord_user_id").notNull(),
  discordGuildId: text("discord_guild_id").notNull(),
  robloxUsername: text("roblox_username").notNull(),
  verificationCode: text("verification_code").notNull(),
  createdAt: timestamp("created_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  isVerified: boolean("is_verified").default(false),
});

// Schema for inserting Discord users
export const insertDiscordUserSchema = createInsertSchema(discordUsers)
  .omit({ id: true, isVerified: true, verifiedAt: true });

// Schema for inserting patrol sessions
export const insertPatrolSessionSchema = createInsertSchema(patrolSessions)
  .omit({ id: true, endTime: true, totalDurationSeconds: true, lastPausedAt: true });

// Schema for updating patrol sessions
export const updatePatrolSessionSchema = z.object({
  status: z.enum(["on_duty", "paused", "off_duty"]),
  endTime: z.date().optional(),
  totalDurationSeconds: z.number().optional(),
  activeDurationSeconds: z.number().optional(),
  lastPausedAt: z.date().optional(),
});

// Schema for inserting verification attempts
export const insertVerificationAttemptSchema = createInsertSchema(verificationAttempts)
  .omit({ id: true, verifiedAt: true, isVerified: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type DiscordUser = typeof discordUsers.$inferSelect;
export type InsertDiscordUser = z.infer<typeof insertDiscordUserSchema>;

export type PatrolSession = typeof patrolSessions.$inferSelect;
export type InsertPatrolSession = z.infer<typeof insertPatrolSessionSchema>;
export type UpdatePatrolSession = z.infer<typeof updatePatrolSessionSchema>;

export type VerificationAttempt = typeof verificationAttempts.$inferSelect;
export type InsertVerificationAttempt = z.infer<typeof insertVerificationAttemptSchema>;

// Original user schema (keeping as required by the database)
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
