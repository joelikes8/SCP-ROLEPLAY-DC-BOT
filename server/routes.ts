import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeBot } from "./discord/bot";
import { WebSocketServer } from "ws";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Create WebSocket server for real-time updates with a specific path
  // to avoid conflicts with Vite's HMR WebSocket
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'  // Define a specific path for our WebSocket
  });
  
  // Handle WebSocket connections
  wss.on("connection", (ws) => {
    console.log("WebSocket client connected to /ws path");
    
    // Send initial data to the client
    sendInitialData(ws);
    
    ws.on("close", () => {
      console.log("WebSocket client disconnected from /ws path");
    });
  });
  
  // Broadcast updates to all connected clients
  function broadcastUpdate(data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  }
  
  // Send initial data when a client connects
  async function sendInitialData(ws: any) {
    try {
      // This is simplified - in a real app, you would get data based on authentication
      const activePatrols = await storage.getAllActivePatrolSessions("global");
      ws.send(JSON.stringify({ type: "initial_data", activePatrols }));
    } catch (error) {
      console.error("Error sending initial data:", error);
    }
  }
  
  // API routes
  
  // Get active patrol sessions
  app.get("/api/patrols/active", async (req, res) => {
    try {
      const guildId = req.query.guildId as string || "global";
      const activePatrols = await storage.getAllActivePatrolSessions(guildId);
      res.json(activePatrols);
    } catch (error) {
      console.error("Error fetching active patrols:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get patrol history for a user
  app.get("/api/patrols/history/:discordUserId", async (req, res) => {
    try {
      const { discordUserId } = req.params;
      const guildId = req.query.guildId as string || "global";
      const limit = parseInt(req.query.limit as string || "10");
      
      const history = await storage.getPatrolSessionHistory(discordUserId, guildId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching patrol history:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get verification status
  app.get("/api/verification/:discordUserId", async (req, res) => {
    try {
      const { discordUserId } = req.params;
      const user = await storage.getDiscordUserByDiscordId(discordUserId);
      
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      
      const verificationStatus = {
        discordId: user.discordId,
        discordUsername: user.discordUsername,
        isVerified: user.isVerified,
        robloxUsername: user.robloxUsername,
        robloxId: user.robloxId,
        verifiedAt: user.verifiedAt
      };
      
      res.json(verificationStatus);
    } catch (error) {
      console.error("Error fetching verification status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Initialize Discord bot with access to storage and broadcast function
  initializeBot(storage, broadcastUpdate);
  
  return httpServer;
}
