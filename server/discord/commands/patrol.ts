import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ButtonInteraction, 
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ActionRowBuilder,
  ComponentType,
  MessageComponentInteraction
} from "discord.js";
import { IStorage } from "../../storage";
import { formatDuration } from "../utils";

// Register patrol command
export function registerPatrolCommand() {
  return new SlashCommandBuilder()
    .setName("patrol")
    .setDescription("Start or manage your patrol session")
    .toJSON();
}

// Handle patrol interactions (command and buttons)
export async function handlePatrolInteraction(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  storage: IStorage,
  broadcastUpdate: Function
) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const guildId = interaction.guild?.id || "global";
  
  try {
    // Log deployment environment and database type
    const isRender = process.env.IS_RENDER === 'true' || process.env.RENDER === 'true';
    const inMemoryMode = process.env.DATABASE_URL ? false : true;
    
    console.log(`Processing patrol for ${username} (${userId}) in guild ${guildId}.`);
    console.log(`Environment: ${isRender ? 'Render' : 'Standard'}, Database: ${inMemoryMode ? 'In-Memory' : 'PostgreSQL'}`);
    
    // Verify storage is available
    if (!storage) {
      console.error('Storage is undefined or null in patrol command');
      throw new Error('Storage unavailable');
    }
    
    // Handle initial patrol command
    if (interaction.isChatInputCommand()) {
      await handlePatrolCommand(interaction, userId, username, guildId, storage, broadcastUpdate);
      return;
    }
    
    // Handle patrol buttons
    if (interaction.isButton()) {
      const customId = interaction.customId;
      console.log(`Processing button interaction: ${customId}`);
      
      if (customId === "patrol_start") {
        await handlePatrolStart(interaction, userId, username, guildId, storage, broadcastUpdate);
      } else if (customId === "patrol_pause") {
        await handlePatrolPause(interaction, userId, username, guildId, storage, broadcastUpdate);
      } else if (customId === "patrol_off_duty") {
        await handlePatrolOffDuty(interaction, userId, username, guildId, storage, broadcastUpdate);
      }
    }
  } catch (error) {
    console.error("Critical error in handlePatrolInteraction:", error);
    
    // Detailed error logging for debugging
    if (error instanceof Error) {
      console.error(`Patrol error details: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    
    // Log environment variables (except secrets)
    console.log('Environment variables check:');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`IS_RENDER: ${process.env.IS_RENDER}`);
    console.log(`RENDER: ${process.env.RENDER}`);
    console.log(`DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    console.log(`DISCORD_TOKEN exists: ${!!process.env.DISCORD_TOKEN}`);
    console.log(`ROBLOX_COOKIE exists: ${!!process.env.ROBLOX_COOKIE}`);
    console.log(`PORT: ${process.env.PORT}`); 
    
    try {
      // Try to respond with error if interaction hasn't been acknowledged yet
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: "❌ An error occurred while processing your patrol. Please try again later.",
          ephemeral: true 
        });
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        await interaction.editReply("❌ An error occurred while processing your patrol. Please try again later.");
      }
    } catch (responseError) {
      // If we can't respond to the interaction (might be timed out)
      console.error("Failed to respond to interaction with error message:", responseError);
    }
  }
}

// Handle the /patrol command
async function handlePatrolCommand(
  interaction: ChatInputCommandInteraction,
  userId: string,
  username: string,
  guildId: string,
  storage: IStorage,
  broadcastUpdate: Function
) {
  // Check if user already has an active patrol session
  const activeSession = await storage.getActivePatrolSession(userId, guildId);
  
  if (activeSession) {
    // User has an active session, show current status
    await showPatrolStatus(interaction, activeSession, storage);
  } else {
    // No active session, show the initial patrol buttons
    await showPatrolButtons(interaction, userId, username);
  }
}

// Show patrol status with buttons
async function showPatrolStatus(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  session: any,
  storage: IStorage
) {
  const status = session.status;
  const startTime = new Date(session.startTime);
  const now = new Date();
  
  // Calculate duration based on status
  let durationInSeconds = 0;
  
  if (status === "on_duty") {
    // For active duty: current active time = (now - start time) + any previous active time
    durationInSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000) + 
      (session.activeDurationSeconds || 0);
  } else if (status === "paused") {
    // For paused: show the stored active duration
    durationInSeconds = session.activeDurationSeconds || 0;
  }
  
  // Create status embed
  const embed = new EmbedBuilder()
    .setColor(status === "on_duty" ? 0x57F287 : status === "paused" ? 0xFEE75C : 0xED4245)
    .setTitle("Patrol Status")
    .setDescription(`<@${session.discordUserId}>'s patrol session`)
    .addFields(
      { name: "Status", value: status === "on_duty" ? "🟢 On Duty" : status === "paused" ? "🟡 Paused" : "🔴 Off Duty" },
      { name: "Started At", value: `<t:${Math.floor(startTime.getTime() / 1000)}:F>` },
      { name: "Duration", value: formatDuration(durationInSeconds) }
    )
    .setTimestamp();
  
  // Create action row with buttons
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("patrol_start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Success)
      .setDisabled(status === "on_duty"),
    new ButtonBuilder()
      .setCustomId("patrol_pause")
      .setLabel("Pause")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(status === "paused"),
    new ButtonBuilder()
      .setCustomId("patrol_off_duty")
      .setLabel("Off Duty")
      .setStyle(ButtonStyle.Danger)
  );
  
  // Reply or update the message
  if (interaction.replied) {
    await interaction.editReply({ embeds: [embed], components: [buttons] });
  } else {
    await interaction.reply({ embeds: [embed], components: [buttons] });
  }
}

// Show initial patrol buttons
async function showPatrolButtons(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  userId: string, 
  username: string
) {
  // Create embed for patrol options
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("Patrol Management")
    .setDescription(`<@${userId}>, select your patrol status:`)
    .setTimestamp();
  
  // Create buttons
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("patrol_start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("patrol_pause")
      .setLabel("Pause")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("patrol_off_duty")
      .setLabel("Off Duty")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true)
  );
  
  // Reply with the embed and buttons
  await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

// Handle start patrol button
async function handlePatrolStart(
  interaction: ButtonInteraction,
  userId: string,
  username: string,
  guildId: string,
  storage: IStorage,
  broadcastUpdate: Function
) {
  try {
    console.log(`Starting patrol for user ${username} (${userId}) in guild ${guildId}`);
    
    // Check for existing patrol session
    let session = await storage.getActivePatrolSession(userId, guildId);
    console.log(`Existing session check result: ${session ? 'Session exists with status ' + session.status : 'No existing session'}`);
    
    if (!session) {
      console.log(`Creating new patrol session for ${username}`);
      
      // Create a new patrol session
      session = await storage.createPatrolSession({
        discordUserId: userId,
        discordGuildId: guildId,
        status: "on_duty",
        startTime: new Date(),
        activeDurationSeconds: 0
      });
      
      console.log(`New session created with ID: ${session.id}`);
      
      // Send broadcast update for dashboard
      console.log(`Broadcasting update for session start`);
      broadcastUpdate({
        type: "patrol_update",
        action: "start",
        userId,
        username,
        guildId,
        session
      });
      
      // Reply with success message and status
      console.log(`Updating interaction with success message`);
      await interaction.update({ content: `✅ You are now on patrol duty!`, components: [] });
      await showPatrolStatus(interaction, session, storage);
    } else if (session.status === "paused") {
      console.log(`Resuming paused session ${session.id} for ${username}`);
      
      // Calculate the active duration
      const now = new Date();
      const pausedTime = session.lastPausedAt ? new Date(session.lastPausedAt) : new Date(session.startTime);
      const previousActiveDuration = session.activeDurationSeconds || 0;
      
      // Update session to active
      console.log(`Updating session to active status`);
      const updatedSession = await storage.updatePatrolSession(session.id, {
        status: "on_duty",
        lastPausedAt: undefined
      });
      
      // Send broadcast update
      console.log(`Broadcasting resume update`);
      broadcastUpdate({
        type: "patrol_update",
        action: "resume",
        userId,
        username,
        guildId,
        session: updatedSession
      });
      
      // Show updated status
      console.log(`Updating interaction with resume message`);
      await interaction.update({ content: `✅ You have resumed your patrol duty!`, components: [] });
      await showPatrolStatus(interaction, updatedSession!, storage);
    } else {
      // Already on duty, just update the status display
      console.log(`User already on duty, updating status display`);
      await showPatrolStatus(interaction, session, storage);
    }
  } catch (error) {
    console.error(`Error in handlePatrolStart for ${username}:`, error);
    if (error instanceof Error) {
      console.error(`Error details: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    
    // Try to respond with error if interaction isn't acknowledged
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.update({ 
          content: "❌ An error occurred while processing your patrol start request. Please try again later.",
          components: [] 
        });
      }
    } catch (responseError) {
      console.error("Failed to respond with error message:", responseError);
    }
  }
}

// Handle pause patrol button
async function handlePatrolPause(
  interaction: ButtonInteraction,
  userId: string,
  username: string,
  guildId: string,
  storage: IStorage,
  broadcastUpdate: Function
) {
  // Get active patrol session
  const session = await storage.getActivePatrolSession(userId, guildId);
  
  if (!session) {
    await interaction.reply({ content: `❌ You don't have an active patrol session.`, ephemeral: true });
    return;
  }
  
  if (session.status === "on_duty") {
    const now = new Date();
    const startTime = new Date(session.startTime);
    const activeDuration = session.activeDurationSeconds || 0;
    
    // Calculate additional active time since last update
    const additionalActiveTime = Math.floor((now.getTime() - 
      (session.lastPausedAt ? new Date(session.lastPausedAt).getTime() : startTime.getTime())) / 1000);
    
    // Update session to paused
    const updatedSession = await storage.updatePatrolSession(session.id, {
      status: "paused",
      activeDurationSeconds: activeDuration + additionalActiveTime,
      lastPausedAt: now
    });
    
    // Send broadcast update
    broadcastUpdate({
      type: "patrol_update",
      action: "pause",
      userId,
      username,
      guildId,
      session: updatedSession
    });
    
    // Show updated status
    await interaction.update({ content: `⏸️ Your patrol duty has been paused!`, components: [] });
    await showPatrolStatus(interaction, updatedSession!, storage);
  } else {
    // Already paused, just update the status display
    await showPatrolStatus(interaction, session, storage);
  }
}

// Handle off duty button
async function handlePatrolOffDuty(
  interaction: ButtonInteraction,
  userId: string,
  username: string,
  guildId: string,
  storage: IStorage,
  broadcastUpdate: Function
) {
  // Get active patrol session
  const session = await storage.getActivePatrolSession(userId, guildId);
  
  if (!session) {
    await interaction.reply({ content: `❌ You don't have an active patrol session.`, ephemeral: true });
    return;
  }
  
  const now = new Date();
  const startTime = new Date(session.startTime);
  
  // Calculate total duration based on status
  let totalDuration = 0;
  
  if (session.status === "on_duty") {
    // For active duty: total time = (now - start time) + any previous active time
    totalDuration = Math.floor((now.getTime() - startTime.getTime()) / 1000) + 
      (session.activeDurationSeconds || 0);
  } else if (session.status === "paused") {
    // For paused: use the stored active duration
    totalDuration = session.activeDurationSeconds || 0;
  }
  
  // Update session to off duty
  const updatedSession = await storage.updatePatrolSession(session.id, {
    status: "off_duty",
    endTime: now,
    totalDurationSeconds: totalDuration
  });
  
  // Send broadcast update
  broadcastUpdate({
    type: "patrol_update",
    action: "end",
    userId,
    username,
    guildId,
    session: updatedSession
  });
  
  // Create completion embed
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle("Patrol Completed")
    .setDescription(`<@${userId}> has completed their patrol duty.`)
    .addFields(
      { name: "Status", value: "🔴 Off Duty" },
      { name: "Started At", value: `<t:${Math.floor(startTime.getTime() / 1000)}:F>` },
      { name: "Ended At", value: `<t:${Math.floor(now.getTime() / 1000)}:F>` },
      { name: "Total Patrol Time", value: formatDuration(totalDuration) }
    )
    .setTimestamp();
  
  // Send completion message
  await interaction.update({ content: `✅ You have gone off duty!`, components: [] });
  await interaction.followUp({ embeds: [embed] });
}
