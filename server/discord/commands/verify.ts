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
import { generateVerificationCode } from "../utils";
import { getRobloxUserByUsername, verifyUserWithCode, getRobloxAvatar } from "../../roblox/api";

// Register verify command
export function registerVerifyCommand() {
  return new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verify your Roblox account")
    .addStringOption(option =>
      option
        .setName("username")
        .setDescription("Your Roblox username")
        .setRequired(true)
    )
    .toJSON();
}

// Handle verify interactions (command and buttons)
export async function handleVerifyInteraction(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  storage: IStorage,
  broadcastUpdate: Function
) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const guildId = interaction.guild?.id || "global";
  
  // Handle initial verify command
  if (interaction.isChatInputCommand()) {
    const robloxUsername = interaction.options.getString("username", true);
    await handleVerifyCommand(interaction, userId, username, guildId, robloxUsername, storage, broadcastUpdate);
    return;
  }
  
  // Handle verify buttons
  if (interaction.isButton()) {
    const customId = interaction.customId;
    
    if (customId === "verify_check") {
      await handleVerifyCheck(interaction, userId, username, guildId, storage, broadcastUpdate);
    } else if (customId === "verify_cancel") {
      await handleVerifyCancel(interaction, userId, storage);
    }
  }
}

// Handle the /verify command
async function handleVerifyCommand(
  interaction: ChatInputCommandInteraction,
  userId: string,
  discordUsername: string,
  guildId: string,
  robloxUsername: string,
  storage: IStorage,
  broadcastUpdate: Function
) {
  try {
    // Check if user is already verified
    const existingUser = await storage.getDiscordUserByDiscordId(userId);
    
    if (existingUser && existingUser.isVerified) {
      await interaction.reply({
        content: `❌ You are already verified as **${existingUser.robloxUsername}**. Use \`/reverify\` if you need to verify with a different account.`,
        ephemeral: true
      });
      return;
    }
    
    // Check if the Roblox username exists
    const robloxUser = await getRobloxUserByUsername(robloxUsername);
    
    if (!robloxUser) {
      await interaction.reply({
        content: `❌ Could not find a Roblox user with the username **${robloxUsername}**. Please check the spelling and try again.`,
        ephemeral: true
      });
      return;
    }
    
    // Generate a verification code
    const verificationCode = generateVerificationCode();
    
    // Store the verification attempt
    let discordUser = existingUser;
    
    if (!discordUser) {
      // Create user if they don't exist
      discordUser = await storage.createDiscordUser({
        discordId: userId,
        discordUsername: discordUsername,
        discordGuildId: guildId,
        verificationCode
      });
    } else {
      // Update existing user with new verification code
      discordUser = await storage.updateDiscordUser(userId, { 
        verificationCode,
        isVerified: false
      }) as any;
    }
    
    // Create verification attempt
    await storage.createVerificationAttempt({
      discordUserId: userId,
      discordGuildId: guildId,
      robloxUsername: robloxUsername,
      verificationCode: verificationCode,
      createdAt: new Date()
    });
    
    // Create verification embed
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("Roblox Verification")
      .setDescription(`<@${userId}>, please verify your Roblox account.`)
      .addFields(
        { name: "Roblox Username", value: robloxUsername },
        { name: "Roblox ID", value: robloxUser.id.toString() },
        { 
          name: "Verification Instructions", 
          value: "1. Go to your Roblox profile\n2. Click the pencil icon to edit your profile\n3. Paste the code below into your About section\n4. Click Save\n5. Click the **Check Verification** button below"
        },
        { name: "Verification Code", value: `\`${verificationCode}\`` }
      )
      .setTimestamp();
    
    // Add Roblox avatar if available
    if (robloxUser.avatarUrl) {
      embed.setThumbnail(robloxUser.avatarUrl);
    }
    
    // Create buttons
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("verify_check")
        .setLabel("Check Verification")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("verify_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
    );
    
    // Reply with verification instructions
    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true
    });
    
  } catch (error) {
    console.error("Error handling verify command:", error);
    await interaction.reply({
      content: "❌ An error occurred while processing your verification. Please try again later.",
      ephemeral: true
    });
  }
}

// Handle the verify check button
async function handleVerifyCheck(
  interaction: ButtonInteraction,
  userId: string,
  username: string,
  guildId: string,
  storage: IStorage,
  broadcastUpdate: Function
) {
  try {
    // Get the latest verification attempt
    const attempt = await storage.getLatestVerificationAttempt(userId);
    
    if (!attempt) {
      await interaction.reply({
        content: "❌ No verification attempt found. Please use `/verify` to start the verification process.",
        ephemeral: true
      });
      return;
    }
    
    // Check if the user has the code in their profile
    const { robloxUsername, verificationCode } = attempt;
    const verificationResult = await verifyUserWithCode(robloxUsername, verificationCode);
    
    if (!verificationResult.success) {
      await interaction.update({
        content: `❌ Verification failed: ${verificationResult.message || "Code not found in your profile."}`,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("verify_check")
              .setLabel("Check Again")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("verify_cancel")
              .setLabel("Cancel")
              .setStyle(ButtonStyle.Danger)
          )
        ],
        embeds: []
      });
      return;
    }
    
    // Verification successful - update user
    const discordUser = await storage.getDiscordUserByDiscordId(userId);
    
    if (!discordUser) {
      await interaction.update({
        content: "❌ Error: Your user data could not be found. Please try again with `/verify`.",
        components: [],
        embeds: []
      });
      return;
    }
    
    // Update user verification status
    const updatedUser = await storage.updateDiscordUser(userId, {
      isVerified: true,
      robloxId: verificationResult.robloxId,
      robloxUsername: robloxUsername,
      verifiedAt: new Date()
    });
    
    // Update verification attempt
    await storage.updateVerificationAttempt(attempt.id, {
      isVerified: true,
      verifiedAt: new Date()
    });
    
    // Try to update nickname
    let nicknameUpdateResult = "Nickname could not be updated.";
    
    if (interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        await member.setNickname(robloxUsername);
        nicknameUpdateResult = `Updated to ${robloxUsername}`;
      } catch (error) {
        console.error("Error updating nickname:", error);
      }
    }
    
    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle("Verification Successful")
      .setDescription(`<@${userId}> has been verified successfully!`)
      .addFields(
        { name: "Roblox Username", value: robloxUsername },
        { name: "Roblox ID", value: verificationResult.robloxId },
        { name: "Discord Nickname", value: nicknameUpdateResult }
      )
      .setTimestamp();
    
    // Add Roblox avatar if available
    const avatarUrl = await getRobloxAvatar(verificationResult.robloxId);
    if (avatarUrl) {
      successEmbed.setThumbnail(avatarUrl);
    }
    
    // Send broadcast update
    broadcastUpdate({
      type: "verification_update",
      action: "verify",
      userId,
      username,
      guildId,
      robloxUsername,
      robloxId: verificationResult.robloxId
    });
    
    // Update the message with success
    await interaction.update({
      content: "✅ Your Roblox account has been verified successfully!",
      embeds: [successEmbed],
      components: []
    });
    
  } catch (error) {
    console.error("Error checking verification:", error);
    await interaction.update({
      content: "❌ An error occurred while checking your verification. Please try again later.",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("verify_check")
            .setLabel("Try Again")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("verify_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Danger)
        )
      ],
      embeds: []
    });
  }
}

// Handle the verify cancel button
async function handleVerifyCancel(
  interaction: ButtonInteraction,
  userId: string,
  storage: IStorage
) {
  // Get the latest verification attempt
  const attempt = await storage.getLatestVerificationAttempt(userId);
  
  if (attempt) {
    // Just mark that the user saw the cancel message
    // We don't actually delete the attempt in case they want to try again
    await interaction.update({
      content: "❌ Verification cancelled. Use `/verify` to start a new verification process.",
      components: [],
      embeds: []
    });
  } else {
    await interaction.update({
      content: "❌ No verification attempt found. Use `/verify` to start the verification process.",
      components: [],
      embeds: []
    });
  }
}
