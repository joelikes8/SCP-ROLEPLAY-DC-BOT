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

// In-memory storage implementation
export class InMemoryStorage implements IStorage {
  private users: User[] = [];
  private discordUsers: DiscordUser[] = [];
  private patrolSessions: PatrolSession[] = [];
  private verificationAttempts: VerificationAttempt[] = [];
  private idCounter = 1;

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: this.idCounter++,
      ...insertUser,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.push(user);
    return user;
  }

  async getDiscordUserByDiscordId(discordId: string): Promise<DiscordUser | undefined> {
    return this.discordUsers.find(user => user.discordId === discordId);
  }

  async createDiscordUser(insertUser: InsertDiscordUser): Promise<DiscordUser> {
    const user: DiscordUser = {
      id: this.idCounter++,
      ...insertUser,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.discordUsers.push(user);
    return user;
  }

  async updateDiscordUser(discordId: string, updates: Partial<DiscordUser>): Promise<DiscordUser | undefined> {
    const userIndex = this.discordUsers.findIndex(user => user.discordId === discordId);
    if (userIndex === -1) return undefined;
    
    const updatedUser = {
      ...this.discordUsers[userIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    this.discordUsers[userIndex] = updatedUser;
    return updatedUser;
  }

  async getActivePatrolSession(discordUserId: string, guildId: string): Promise<PatrolSession | undefined> {
    return this.patrolSessions.find(session => 
      session.discordUserId === discordUserId && 
      session.discordGuildId === guildId &&
      (session.status === "on_duty" || session.status === "paused")
    );
  }

  async getAllActivePatrolSessions(guildId: string): Promise<PatrolSession[]> {
    return this.patrolSessions.filter(session => 
      session.discordGuildId === guildId &&
      (session.status === "on_duty" || session.status === "paused")
    );
  }

  async createPatrolSession(insertSession: InsertPatrolSession): Promise<PatrolSession> {
    const session: PatrolSession = {
      id: this.idCounter++,
      ...insertSession,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.patrolSessions.push(session);
    return session;
  }

  async updatePatrolSession(id: number, updates: UpdatePatrolSession): Promise<PatrolSession | undefined> {
    const sessionIndex = this.patrolSessions.findIndex(session => session.id === id);
    if (sessionIndex === -1) return undefined;
    
    const updatedSession = {
      ...this.patrolSessions[sessionIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    this.patrolSessions[sessionIndex] = updatedSession;
    return updatedSession;
  }

  async getPatrolSessionById(id: number): Promise<PatrolSession | undefined> {
    return this.patrolSessions.find(session => session.id === id);
  }

  async getPatrolSessionHistory(discordUserId: string, guildId: string, limit: number): Promise<PatrolSession[]> {
    return this.patrolSessions
      .filter(session => 
        session.discordUserId === discordUserId && 
        session.discordGuildId === guildId &&
        session.status === "off_duty"
      )
      .sort((a, b) => {
        if (!a.endTime || !b.endTime) return 0;
        return b.endTime.getTime() - a.endTime.getTime();
      })
      .slice(0, limit);
  }

  async createVerificationAttempt(insertAttempt: InsertVerificationAttempt): Promise<VerificationAttempt> {
    const attempt: VerificationAttempt = {
      id: this.idCounter++,
      ...insertAttempt,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.verificationAttempts.push(attempt);
    return attempt;
  }

  async getVerificationAttempt(discordUserId: string, code: string): Promise<VerificationAttempt | undefined> {
    return this.verificationAttempts.find(attempt => 
      attempt.discordUserId === discordUserId &&
      attempt.verificationCode === code
    );
  }

  async updateVerificationAttempt(id: number, updates: Partial<VerificationAttempt>): Promise<VerificationAttempt | undefined> {
    const attemptIndex = this.verificationAttempts.findIndex(attempt => attempt.id === id);
    if (attemptIndex === -1) return undefined;
    
    const updatedAttempt = {
      ...this.verificationAttempts[attemptIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    this.verificationAttempts[attemptIndex] = updatedAttempt;
    return updatedAttempt;
  }

  async getLatestVerificationAttempt(discordUserId: string): Promise<VerificationAttempt | undefined> {
    return this.verificationAttempts
      .filter(attempt => attempt.discordUserId === discordUserId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    if (!db) throw new Error("Database not available");
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) throw new Error("Database not available");
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not available");
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getDiscordUserByDiscordId(discordId: string): Promise<DiscordUser | undefined> {
    if (!db) throw new Error("Database not available");
    const [user] = await db.select().from(discordUsers).where(eq(discordUsers.discordId, discordId));
    return user;
  }

  async createDiscordUser(insertUser: InsertDiscordUser): Promise<DiscordUser> {
    if (!db) throw new Error("Database not available");
    const [user] = await db
      .insert(discordUsers)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateDiscordUser(discordId: string, updates: Partial<DiscordUser>): Promise<DiscordUser | undefined> {
    if (!db) throw new Error("Database not available");
    const [updatedUser] = await db
      .update(discordUsers)
      .set(updates)
      .where(eq(discordUsers.discordId, discordId))
      .returning();
    return updatedUser;
  }

  async getActivePatrolSession(discordUserId: string, guildId: string): Promise<PatrolSession | undefined> {
    if (!db) throw new Error("Database not available");
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
    if (!db) throw new Error("Database not available");
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
    if (!db) throw new Error("Database not available");
    const [session] = await db
      .insert(patrolSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async updatePatrolSession(id: number, updates: UpdatePatrolSession): Promise<PatrolSession | undefined> {
    if (!db) throw new Error("Database not available");
    const [updatedSession] = await db
      .update(patrolSessions)
      .set(updates)
      .where(eq(patrolSessions.id, id))
      .returning();
    return updatedSession;
  }

  async getPatrolSessionById(id: number): Promise<PatrolSession | undefined> {
    if (!db) throw new Error("Database not available");
    const [session] = await db
      .select()
      .from(patrolSessions)
      .where(eq(patrolSessions.id, id));
    return session;
  }

  async getPatrolSessionHistory(discordUserId: string, guildId: string, limit: number): Promise<PatrolSession[]> {
    if (!db) throw new Error("Database not available");
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
    if (!db) throw new Error("Database not available");
    const [attempt] = await db
      .insert(verificationAttempts)
      .values(insertAttempt)
      .returning();
    return attempt;
  }

  async getVerificationAttempt(discordUserId: string, code: string): Promise<VerificationAttempt | undefined> {
    if (!db) throw new Error("Database not available");
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
    if (!db) throw new Error("Database not available");
    const [updatedAttempt] = await db
      .update(verificationAttempts)
      .set(updates)
      .where(eq(verificationAttempts.id, id))
      .returning();
    return updatedAttempt;
  }

  async getLatestVerificationAttempt(discordUserId: string): Promise<VerificationAttempt | undefined> {
    if (!db) throw new Error("Database not available");
    const [attempt] = await db
      .select()
      .from(verificationAttempts)
      .where(eq(verificationAttempts.discordUserId, discordUserId))
      .orderBy(desc(verificationAttempts.createdAt))
      .limit(1);
    return attempt;
  }
}

// Create and export the appropriate storage based on mode
export const storage: IStorage = inMemoryMode ? new InMemoryStorage() : new DatabaseStorage();