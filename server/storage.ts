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
} from "@shared/schema";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private discordUsers: Map<string, DiscordUser>;
  private patrolSessions: Map<number, PatrolSession>;
  private verificationAttempts: Map<number, VerificationAttempt>;
  
  private userId: number;
  private discordUserId: number;
  private patrolSessionId: number;
  private verificationAttemptId: number;

  constructor() {
    this.users = new Map();
    this.discordUsers = new Map();
    this.patrolSessions = new Map();
    this.verificationAttempts = new Map();
    
    this.userId = 1;
    this.discordUserId = 1;
    this.patrolSessionId = 1;
    this.verificationAttemptId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Discord user methods
  async getDiscordUserByDiscordId(discordId: string): Promise<DiscordUser | undefined> {
    return Array.from(this.discordUsers.values()).find(
      (user) => user.discordId === discordId
    );
  }

  async createDiscordUser(insertUser: InsertDiscordUser): Promise<DiscordUser> {
    const id = this.discordUserId++;
    const user: DiscordUser = { 
      ...insertUser, 
      id, 
      isVerified: false,
      verifiedAt: null
    };
    this.discordUsers.set(id, user);
    return user;
  }

  async updateDiscordUser(discordId: string, updates: Partial<DiscordUser>): Promise<DiscordUser | undefined> {
    const user = await this.getDiscordUserByDiscordId(discordId);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.discordUsers.set(user.id, updatedUser);
    return updatedUser;
  }

  // Patrol session methods
  async getActivePatrolSession(discordUserId: string, guildId: string): Promise<PatrolSession | undefined> {
    return Array.from(this.patrolSessions.values()).find(
      (session) => 
        session.discordUserId === discordUserId && 
        session.discordGuildId === guildId && 
        (session.status === "on_duty" || session.status === "paused")
    );
  }

  async getAllActivePatrolSessions(guildId: string): Promise<PatrolSession[]> {
    return Array.from(this.patrolSessions.values()).filter(
      (session) => 
        session.discordGuildId === guildId && 
        (session.status === "on_duty" || session.status === "paused")
    );
  }

  async createPatrolSession(insertSession: InsertPatrolSession): Promise<PatrolSession> {
    const id = this.patrolSessionId++;
    const session: PatrolSession = {
      ...insertSession,
      id,
      endTime: null,
      totalDurationSeconds: null,
      lastPausedAt: null
    };
    this.patrolSessions.set(id, session);
    return session;
  }

  async updatePatrolSession(id: number, updates: UpdatePatrolSession): Promise<PatrolSession | undefined> {
    const session = await this.getPatrolSessionById(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.patrolSessions.set(id, updatedSession);
    return updatedSession;
  }

  async getPatrolSessionById(id: number): Promise<PatrolSession | undefined> {
    return this.patrolSessions.get(id);
  }

  async getPatrolSessionHistory(discordUserId: string, guildId: string, limit: number): Promise<PatrolSession[]> {
    return Array.from(this.patrolSessions.values())
      .filter(session => 
        session.discordUserId === discordUserId && 
        session.discordGuildId === guildId
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  // Verification methods
  async createVerificationAttempt(insertAttempt: InsertVerificationAttempt): Promise<VerificationAttempt> {
    const id = this.verificationAttemptId++;
    const attempt: VerificationAttempt = {
      ...insertAttempt,
      id,
      verifiedAt: null,
      isVerified: false
    };
    this.verificationAttempts.set(id, attempt);
    return attempt;
  }

  async getVerificationAttempt(discordUserId: string, code: string): Promise<VerificationAttempt | undefined> {
    return Array.from(this.verificationAttempts.values()).find(
      (attempt) => 
        attempt.discordUserId === discordUserId && 
        attempt.verificationCode === code
    );
  }

  async updateVerificationAttempt(id: number, updates: Partial<VerificationAttempt>): Promise<VerificationAttempt | undefined> {
    const attempt = this.verificationAttempts.get(id);
    if (!attempt) return undefined;
    
    const updatedAttempt = { ...attempt, ...updates };
    this.verificationAttempts.set(id, updatedAttempt);
    return updatedAttempt;
  }

  async getLatestVerificationAttempt(discordUserId: string): Promise<VerificationAttempt | undefined> {
    const attempts = Array.from(this.verificationAttempts.values())
      .filter(attempt => attempt.discordUserId === discordUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return attempts.length > 0 ? attempts[0] : undefined;
  }
}

export const storage = new MemStorage();
