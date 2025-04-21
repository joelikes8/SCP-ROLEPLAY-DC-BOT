import { Client, GatewayIntentBits, Events, REST, Routes } from "discord.js";
import { IStorage } from "../storage";
import { registerPatrolCommand, handlePatrolInteraction } from "./commands/patrol";
import { registerVerifyCommand, handleVerifyInteraction } from "./commands/verify";
import { registerReverifyCommand, handleReverifyInteraction } from "./commands/reverify";

export async function initializeBot(storage: IStorage, broadcastUpdate: Function) {
  // Check for Discord token
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error("DISCORD_TOKEN is required. Please add it to your environment variables.");
    return null;
  }
  
  // Now token is guaranteed to be a string

  // Create Discord bot client with necessary intents - minimal permissions required
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds, // For basic guild information
    ],
    // Adding options to make the bot more resilient
    failIfNotExists: false,
    rest: {
      retries: 5, // Number of retries for REST API calls
      timeout: 60000, // Longer timeout (60 seconds)
    }
  });

  // Set up auto-reconnection handling
  client.on(Events.Error, (error) => {
    console.error(`Discord client error: ${error.message}`);
  });
  
  client.on(Events.Warn, (warning) => {
    console.warn(`Discord warning: ${warning}`);
  });
  
  client.on(Events.ShardDisconnect, () => {
    console.log("Discord bot disconnected. Attempting to reconnect...");
  });
  
  client.on(Events.ShardReconnecting, () => {
    console.log("Discord bot reconnecting...");
  });
  
  client.on(Events.ShardResume, () => {
    console.log("Discord bot reconnected successfully!");
  });

  // Handle ready event
  client.once(Events.ClientReady, async (c) => {
    console.log(`Discord bot ready! Logged in as ${c.user.tag}`);
    
    try {
      // Register slash commands with Discord
      await registerCommands(c.user.id);
      console.log("Slash commands registered successfully!");
    } catch (error) {
      console.error("Error registering commands:", error);
    }
  });

  // Handle slash command interactions
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        
        if (commandName === "patrol") {
          await handlePatrolInteraction(interaction, storage, broadcastUpdate);
        } else if (commandName === "verify") {
          await handleVerifyInteraction(interaction, storage, broadcastUpdate);
        } else if (commandName === "reverify") {
          await handleReverifyInteraction(interaction, storage, broadcastUpdate);
        }
      }
      
      // Handle button interactions
      if (interaction.isButton()) {
        const customId = interaction.customId;
        
        if (customId.startsWith("patrol_")) {
          await handlePatrolInteraction(interaction, storage, broadcastUpdate);
        } else if (customId.startsWith("verify_")) {
          await handleVerifyInteraction(interaction, storage, broadcastUpdate);
        } else if (customId.startsWith("reverify_")) {
          await handleReverifyInteraction(interaction, storage, broadcastUpdate);
        }
      }
    } catch (error) {
      console.error("Error handling interaction:", error);
      
      // Respond with error message if interaction hasn't been acknowledged
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: "An error occurred while processing your request. Please try again later.",
          ephemeral: true 
        });
      }
    }
  });

  // Register slash commands with Discord API
  async function registerCommands(clientId: string) {
    const commands = [
      registerPatrolCommand(),
      registerVerifyCommand(),
      registerReverifyCommand()
    ];
    
    // Token is checked at the beginning of the function
    const rest = new REST({ version: '10' }).setToken(token as string);
    
    // Register commands globally (for all guilds)
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
  }

  // Login to Discord
  try {
    await client.login(token);
    
    // Set up a ping mechanism to keep the bot online
    // This helps prevent the bot from going offline due to inactivity
    const pingInterval = 5 * 60 * 1000; // 5 minutes
    setInterval(() => {
      console.log("Sending heartbeat ping to keep Discord connection alive...");
      // Check if the client is still connected
      if (client.isReady()) {
        console.log(`Discord heartbeat: Bot is online as ${client.user?.tag}`);
      } else {
        console.warn("Discord bot appears to be offline, attempting to reconnect...");
        client.login(token).catch(err => {
          console.error("Failed to reconnect to Discord:", err);
        });
      }
    }, pingInterval);
  } catch (error) {
    console.error("Failed to login to Discord:", error);
  }
  
  return client;
}
