import {
  User,
  InsertUser,
  DiscordUser,
  InsertDiscordUser,
  PatrolSession,
  InsertPatrolSession,
  UpdatePatrolSession,
  VerificationAttempt,
  InsertVerificationAttempt,
  users, 
  discordUsers, 
  patrolSessions, 
  verificationAttempts
} from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { db, inMemoryMode } from "./db";

// In-memory storage arrays for fallback mode
const memoryUsers: User[] = [];
const memoryDiscordUsers: DiscordUser[] = [];
const memoryPatrolSessions: PatrolSession[] = [];
const memoryVerificationAttempts: VerificationAttempt[] = [];

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Discord user methods
  getDiscordUserByDiscordId(discordId: string): Promise<DiscordUser | undefined>;
  createDiscordUser(user: InsertDiscordUser): Promise<DiscordUser>;
  updateDiscordUser(discordId: string, updates: Partial<DiscordUser>): Promise<DiscordUser | undefined>;

  // Patrol session methods
  getActivePatrolSession(discordUserId: string, guildId: string): Promise<PatrolSession | undefined>;
  getAllActivePatrolSessions(guildId: string): Promise<PatrolSession[]>;
  createPatrolSession(session: InsertPatrolSession): Promise<PatrolSession>;
  updatePatrolSession(id: number, updates: UpdatePatrolSession): Promise<PatrolSession | undefined>;
  getPatrolSessionById(id: number): Promise<PatrolSession | undefined>;
  getPatrolSessionHistory(discordUserId: string, guildId: string, limit: number): Promise<PatrolSession[]>;

  // Verification methods
  createVerificationAttempt(attempt: InsertVerificationAttempt): Promise<VerificationAttempt>;
  getVerificationAttempt(discordUserId: string, code: string): Promise<VerificationAttempt | undefined>;
  updateVerificationAttempt(id: number, updates: Partial<VerificationAttempt>): Promise<VerificationAttempt | undefined>;
  getLatestVerificationAttempt(discordUserId: string): Promise<VerificationAttempt | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getDiscordUserByDiscordId(discordId: string): Promise<DiscordUser | undefined> {
    const [user] = await db.select().from(discordUsers).where(eq(discordUsers.discordId, discordId));
    return user;
  }

  async createDiscordUser(insertUser: InsertDiscordUser): Promise<DiscordUser> {
    const [user] = await db
      .insert(discordUsers)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateDiscordUser(discordId: string, updates: Partial<DiscordUser>): Promise<DiscordUser | undefined> {
    const [updatedUser] = await db
      .update(discordUsers)
      .set(updates)
      .where(eq(discordUsers.discordId, discordId))
      .returning();
    return updatedUser;
  }

  async getActivePatrolSession(discordUserId: string, guildId: string): Promise<PatrolSession | undefined> {
    const [session] = await db
      .select()
      .from(patrolSessions)
      .where(
        and(
          eq(patrolSessions.discordUserId, discordUserId),
          eq(patrolSessions.discordGuildId, guildId),
          or(
            eq(patrolSessions.status, "on_duty"),
            eq(patrolSessions.status, "paused")
          )
        )
      );
    return session;
  }

  async getAllActivePatrolSessions(guildId: string): Promise<PatrolSession[]> {
    return db
      .select()
      .from(patrolSessions)
      .where(
        and(
          eq(patrolSessions.discordGuildId, guildId),
          or(
            eq(patrolSessions.status, "on_duty"),
            eq(patrolSessions.status, "paused")
          )
        )
      );
  }

  async createPatrolSession(insertSession: InsertPatrolSession): Promise<PatrolSession> {
    const [session] = await db
      .insert(patrolSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async updatePatrolSession(id: number, updates: UpdatePatrolSession): Promise<PatrolSession | undefined> {
    const [updatedSession] = await db
      .update(patrolSessions)
      .set(updates)
      .where(eq(patrolSessions.id, id))
      .returning();
    return updatedSession;
  }

  async getPatrolSessionById(id: number): Promise<PatrolSession | undefined> {
    const [session] = await db
      .select()
      .from(patrolSessions)
      .where(eq(patrolSessions.id, id));
    return session;
  }

  async getPatrolSessionHistory(discordUserId: string, guildId: string, limit: number): Promise<PatrolSession[]> {
    return db
      .select()
      .from(patrolSessions)
      .where(
        and(
          eq(patrolSessions.discordUserId, discordUserId),
          eq(patrolSessions.discordGuildId, guildId),
          eq(patrolSessions.status, "off_duty")
        )
      )
      .orderBy(desc(patrolSessions.endTime))
      .limit(limit);
  }

  async createVerificationAttempt(insertAttempt: InsertVerificationAttempt): Promise<VerificationAttempt> {
    const [attempt] = await db
      .insert(verificationAttempts)
      .values(insertAttempt)
      .returning();
    return attempt;
  }

  async getVerificationAttempt(discordUserId: string, code: string): Promise<VerificationAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(verificationAttempts)
      .where(
        and(
          eq(verificationAttempts.discordUserId, discordUserId),
          eq(verificationAttempts.verificationCode, code)
        )
      );
    return attempt;
  }

  async updateVerificationAttempt(id: number, updates: Partial<VerificationAttempt>): Promise<VerificationAttempt | undefined> {
    const [updatedAttempt] = await db
      .update(verificationAttempts)
      .set(updates)
      .where(eq(verificationAttempts.id, id))
      .returning();
    return updatedAttempt;
  }

  async getLatestVerificationAttempt(discordUserId: string): Promise<VerificationAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(verificationAttempts)
      .where(eq(verificationAttempts.discordUserId, discordUserId))
      .orderBy(desc(verificationAttempts.createdAt))
      .limit(1);
    return attempt;
  }
}

export const storage = new DatabaseStorage();