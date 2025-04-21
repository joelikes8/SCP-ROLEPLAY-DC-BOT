import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ButtonInteraction, 
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ActionRowBuilder
} from "discord.js";
import { IStorage } from "../../storage";
import { getRobloxAvatar } from "../../roblox/api";

// Register reverify command
export function registerReverifyCommand() {
  // Create command with simplified structure for better compatibility
  const command = new SlashCommandBuilder()
    .setName("reverify")
    .setDescription("Reverify with a different Roblox account");
    
  // Convert to JSON for registration
  return command.toJSON();
}

// Handle reverify interactions (command and buttons)
export async function handleReverifyInteraction(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  storage: IStorage,
  broadcastUpdate: Function
) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const guildId = interaction.guild?.id || "global";
  
  // Handle initial reverify command
  if (interaction.isChatInputCommand()) {
    await handleReverifyCommand(interaction, userId, username, guildId, storage, broadcastUpdate);
    return;
  }
  
  // Handle reverify buttons
  if (interaction.isButton()) {
    const customId = interaction.customId;
    
    if (customId === "reverify_start") {
      await handleReverifyStart(interaction, userId, storage);
    } else if (customId === "reverify_cancel") {
      await handleReverifyCancel(interaction);
    }
  }
}

// Handle the /reverify command
async function handleReverifyCommand(
  interaction: ChatInputCommandInteraction,
  userId: string,
  discordUsername: string,
  guildId: string,
  storage: IStorage,
  broadcastUpdate: Function
) {
  try {
    // Check if user is already verified
    const existingUser = await storage.getDiscordUserByDiscordId(userId);
    
    if (!existingUser || !existingUser.isVerified) {
      await interaction.reply({
        content: `❌ You are not currently verified. Use \`/verify\` to verify your Roblox account.`,
        ephemeral: true
      });
      return;
    }
    
    // Get avatar URL if available
    const avatarUrl = await getRobloxAvatar(existingUser.robloxId || "");
    
    // Create reverify embed
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("Roblox Reverification")
      .setDescription(`<@${userId}>, you're already verified but can reverify with a different account.`)
      .addFields(
        { name: "Current Verification", value: `You are currently verified as **${existingUser.robloxUsername}**` },
        { name: "Roblox ID", value: existingUser.robloxId || "Unknown" },
        { name: "Verified On", value: existingUser.verifiedAt ? 
          `<t:${Math.floor(new Date(existingUser.verifiedAt).getTime() / 1000)}:R>` : 
          "Unknown" 
        }
      )
      .setTimestamp();
    
    // Add Roblox avatar if available
    if (avatarUrl) {
      embed.setThumbnail(avatarUrl);
    }
    
    // Create buttons
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("reverify_start")
        .setLabel("Start New Verification")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("reverify_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );
    
    // Reply with reverification options
    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true
    });
    
  } catch (error) {
    console.error("Error handling reverify command:", error);
    await interaction.reply({
      content: "❌ An error occurred while processing your reverification request. Please try again later.",
      ephemeral: true
    });
  }
}

// Handle the start new verification button
async function handleReverifyStart(
  interaction: ButtonInteraction,
  userId: string,
  storage: IStorage
) {
  try {
    
    // Reset the user's verification status in the database
    await storage.updateDiscordUser(userId, {
      isVerified: false,
      robloxId: null,
      robloxUsername: null,
      verifiedAt: null
    });
    
    // Notify the user
    await interaction.update({
      content: "✅ Starting new verification process. Your previous verification has been cleared. Please use the `/verify` command with your new Roblox username.",
      components: [],
      embeds: []
    });
    
  } catch (error) {
    console.error("Error resetting verification status:", error);
    await interaction.update({
      content: "❌ An error occurred while resetting your verification. Please try again later.",
      components: [],
      embeds: []
    });
  }
}

// Handle the cancel button
async function handleReverifyCancel(
  interaction: ButtonInteraction
) {
  await interaction.update({
    content: "✅ Reverification cancelled. You're still verified with your current Roblox account.",
    components: [],
    embeds: []
  });
}
