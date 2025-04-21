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
    
    // Check if we're running in Render
    const isRender = process.env.RENDER === 'true' || process.env.IS_RENDER === 'true' || !!process.env.RENDER_EXTERNAL_URL;
    
    // On Render, introduce a delay before registering commands to ensure the connection is stable
    if (isRender) {
      console.log("Running on Render - delaying slash command registration for 5 seconds to ensure connection stability...");
      setTimeout(async () => {
        try {
          await registerCommands(c.user.id);
          console.log("Slash commands registered successfully on Render!");
          
          // Optional: Verify command registration after a short delay
          setTimeout(async () => {
            try {
              // Fetch registered commands to verify registration
              const rest = new REST({ version: '10' }).setToken(token as string);
              const commands = await rest.get(
                Routes.applicationCommands(c.user.id)
              ) as any[];
              
              console.log(`Command verification: ${commands.length} commands found on Discord`);
              commands.forEach(cmd => {
                console.log(`- Registered command: ${cmd.name}`);
              });
            } catch (verifyError) {
              console.error("Failed to verify command registration:", verifyError);
            }
          }, 5000);
        } catch (error) {
          console.error("Error registering commands on Render:", error);
          
          // In case of failure, try one more time after a longer delay
          console.log("Retrying command registration in 30 seconds...");
          setTimeout(async () => {
            try {
              await registerCommands(c.user.id);
              console.log("Slash commands registered successfully on retry!");
            } catch (retryError) {
              console.error("Command registration retry failed:", retryError);
            }
          }, 30000);
        }
      }, 5000);
    } else {
      // For local development, register commands immediately
      try {
        await registerCommands(c.user.id);
        console.log("Slash commands registered successfully!");
      } catch (error) {
        console.error("Error registering commands:", error);
      }
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
    
    try {
      console.log(`Starting to refresh application (/) commands for bot ID: ${clientId}`);
      
      // Register commands globally (for all guilds)
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      
      // Log success with more details
      console.log(`Successfully registered ${Array.isArray(data) ? data.length : 'unknown number of'} application commands globally`);
      console.log(`Command registration details: ${JSON.stringify(commands.map(cmd => ({ name: cmd.name, description: cmd.description })))}`);
    } catch (error) {
      // Enhanced error logging
      console.error('Failed to register application commands:', error);
      
      // Additional debug information
      if (error instanceof Error) {
        console.error(`Error details: ${error.message}`);
        console.error(`Error stack: ${error.stack}`);
        
        // Check for common Discord API errors
        if (error.message.includes('Missing Access') || error.message.includes('Missing Permissions')) {
          console.error('This error suggests the bot token may not have the correct scopes or permissions.');
          console.error('Make sure your bot has the applications.commands scope in the Discord Developer Portal.');
        }
        
        if (error.message.includes('Invalid Form Body')) {
          console.error('This error suggests an issue with the command structure.');
          console.error('Command data:', JSON.stringify(commands));
        }
      }
    }
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
