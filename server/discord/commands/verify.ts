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
  // Create command with simplified structure for better compatibility
  const command = new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verify your Roblox account")
    .addStringOption(option =>
      option
        .setName("username")
        .setDescription("Your Roblox username")
        .setRequired(true)
    );
    
  // Convert to JSON for registration
  return command.toJSON();
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
  
  try {
    // Log deployment environment
    const isRender = process.env.RENDER === 'true';
    console.log(`Processing verification for ${username} (${userId}) in guild ${guildId}. Environment: ${isRender ? 'Render' : 'Standard'}`);
    
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
  } catch (error) {
    console.error("Critical error in handleVerifyInteraction:", error);
    
    // Detailed error logging for debugging
    if (error instanceof Error) {
      console.error(`Verification error details: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    
    try {
      // Try to respond with error if interaction hasn't been acknowledged yet
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: "❌ An error occurred while processing your verification. Please try again later.",
          ephemeral: true 
        });
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        await interaction.editReply("❌ An error occurred while processing your verification. Please try again later.");
      }
    } catch (responseError) {
      // If we can't respond to the interaction (might be timed out)
      console.error("Failed to respond to interaction with error message:", responseError);
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
  // First defer the reply to prevent interaction timeout
  await interaction.deferReply({ ephemeral: true });
  
  try {
    // Check if user is already verified
    const existingUser = await storage.getDiscordUserByDiscordId(userId);
    
    if (existingUser && existingUser.isVerified) {
      await interaction.editReply({
        content: `❌ You are already verified as **${existingUser.robloxUsername}**. Use \`/reverify\` if you need to verify with a different account.`
      });
      return;
    }
    
    // Inform user that we're processing their request
    await interaction.editReply({
      content: `🔍 Looking up Roblox user **${robloxUsername}**... This might take a moment due to Roblox API limits.`
    });
    
    // Check if the Roblox username exists with better error handling
    let robloxUser = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!robloxUser && retryCount < maxRetries) {
      try {
        robloxUser = await getRobloxUserByUsername(robloxUsername);
        
        if (!robloxUser && retryCount < maxRetries - 1) {
          retryCount++;
          await interaction.editReply({
            content: `🔄 Retry ${retryCount}/${maxRetries}: Looking up Roblox user **${robloxUsername}**...`
          });
          // Wait longer between retries (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 3000 * retryCount));
        }
      } catch (err) {
        console.error(`Error on retry ${retryCount}:`, err);
        retryCount++;
        
        if (retryCount < maxRetries) {
          await interaction.editReply({
            content: `⚠️ Encountered an error. Retry ${retryCount}/${maxRetries}: Looking up Roblox user **${robloxUsername}**...`
          });
          // Wait longer between retries
          await new Promise(resolve => setTimeout(resolve, 3000 * retryCount));
        }
      }
    }
    
    if (!robloxUser) {
      await interaction.editReply({
        content: `❌ Could not find a Roblox user with the username **${robloxUsername}** after ${maxRetries} attempts. Please check the spelling and try again later.`
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
          value: "1. Go to your Roblox profile\n2. Click the pencil icon to edit your profile\n3. Copy the code below\n4. Paste it into your About section\n5. If Roblox filters the code, try typing it manually without spaces\n6. Click Save\n7. Click the **Check Verification** button below"
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
    await interaction.editReply({
      content: "✅ Found Roblox user! Please follow these instructions:",
      embeds: [embed],
      components: [buttons]
    });
    
  } catch (error) {
    console.error("Error handling verify command:", error);
    await interaction.editReply({
      content: "❌ An error occurred while processing your verification. Please try again later."
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
  // Defer update to prevent interaction timeout
  await interaction.deferUpdate();
  
  try {
    // First, get the latest verification attempt
    const attempt = await storage.getLatestVerificationAttempt(userId);
    
    if (!attempt) {
      await interaction.editReply({
        content: "❌ No verification attempt found. Please use `/verify` to start the verification process.",
        components: [],
        embeds: []
      });
      return;
    }
    
    // Log details for debugging
    console.log(`Verification check initiated for Discord user ${userId}, Roblox username: ${attempt.robloxUsername}, code: ${attempt.verificationCode}`);
    
    // Check Roblox authentication status
    const { hasRobloxAuth, validateRobloxCookie } = await import('../../roblox/auth');
    let authMethod = "Public API";
    
    if (hasRobloxAuth) {
      // Test the Roblox cookie before proceeding
      const valid = await validateRobloxCookie();
      if (valid) {
        authMethod = "Authenticated API";
        console.log(`Using authenticated Roblox API for user ${attempt.robloxUsername}`);
      } else {
        console.warn(`Roblox cookie validation failed, falling back to public API for user ${attempt.robloxUsername}`);
      }
    }
    
    // Update user on status
    await interaction.editReply({
      content: `🔍 Checking your Roblox profile for verification code... This might take a moment due to Roblox API limits.`,
      components: [],
      embeds: []
    });
    
    // Check if the user has the code in their profile with retries
    const { robloxUsername, verificationCode } = attempt;
    let verificationResult = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        if (retryCount > 0) {
          await interaction.editReply({
            content: `🔄 Retry ${retryCount}/${maxRetries}: Checking your Roblox profile...`,
            components: [],
            embeds: []
          });
        }
        
        console.log(`Verification attempt ${retryCount + 1} for ${robloxUsername} using ${authMethod}`);
        verificationResult = await verifyUserWithCode(robloxUsername, verificationCode);
        
        if (verificationResult.success) {
          console.log(`✅ Verification successful for ${robloxUsername}`);
          break;
        } else {
          console.log(`❌ Verification failed for ${robloxUsername}: ${verificationResult.message}`);
          if (retryCount < maxRetries - 1) {
            retryCount++;
            // Wait longer between retries (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 3000 * retryCount));
          } else {
            break;
          }
        }
      } catch (err) {
        console.error(`Error on verification retry ${retryCount}:`, err);
        retryCount++;
        
        if (retryCount < maxRetries) {
          await interaction.editReply({
            content: `⚠️ Encountered an error. Retry ${retryCount}/${maxRetries}: Checking your Roblox profile...`,
            components: [],
            embeds: []
          });
          // Wait longer between retries
          await new Promise(resolve => setTimeout(resolve, 3000 * retryCount));
        } else {
          break;
        }
      }
    }
    
    // If after all retries, we failed or no result
    if (!verificationResult || !verificationResult.success) {
      const failButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("verify_check")
          .setLabel("Check Again")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("verify_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );
      
      let errorMessage = verificationResult?.message || "Code not found in your profile after multiple attempts.";
      
      // Provide more helpful error messages
      if (errorMessage.includes("not found in your profile")) {
        errorMessage += "\n\n__Make sure to:__\n";
        errorMessage += "• Put the **exact** code in your About section\n";
        errorMessage += "• **Save** your profile after adding the code\n";
        errorMessage += "• If the code is getting filtered by Roblox, try adding spaces between characters\n";
        errorMessage += "• Check that you're verifying the correct Roblox account";
      }
      
      await interaction.editReply({
        content: `❌ Verification failed: ${errorMessage}`,
        components: [failButtons],
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
    let nicknameUpdateResult = "Nickname could not be updated (missing permissions).";
    
    if (interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        await member.setNickname(robloxUsername);
        nicknameUpdateResult = `Updated to ${robloxUsername}`;
      } catch (errorObj) {
        // Discord API error 50013 is "Missing Permissions" which is common and expected
        // when the bot doesn't have permission to change nicknames
        const error = errorObj as any; // Cast to any to check for code property
        if (error && typeof error === 'object' && error.code === 50013) {
          console.log("Cannot update nickname due to missing permissions - this is normal if bot lacks permission");
        } else {
          console.error("Error updating nickname:", error);
        }
      }
    }
    
    // Create success embed with different messages based on verification method
    let isAltVerification = verificationResult.message && verificationResult.message.includes("alternative methods");
    
    const successEmbed = new EmbedBuilder()
      .setColor(isAltVerification ? 0xFFA500 : 0x57F287) // Orange for alternative verification, green for normal
      .setTitle("Verification Successful")
      .setDescription(isAltVerification 
        ? `<@${userId}> has been verified using an alternative method.`
        : `<@${userId}> has been verified successfully!`)
      .addFields(
        { name: "Roblox Username", value: robloxUsername },
        { name: "Roblox ID", value: verificationResult.robloxId || "Unknown" },
        { name: "Discord Nickname", value: nicknameUpdateResult }
      );
      
    // Add verification method information if using alternative method
    if (isAltVerification) {
      successEmbed.addFields({
        name: "Verification Method",
        value: "⚠️ Alternative verification was used because your Roblox profile couldn't be accessed."
      });
    }
    
    successEmbed.setTimestamp();
    
    // Add Roblox avatar if available
    if (verificationResult.robloxId) {
      const avatarUrl = await getRobloxAvatar(verificationResult.robloxId);
      if (avatarUrl) {
        successEmbed.setThumbnail(avatarUrl);
      }
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
    try {
      await interaction.update({
        content: "✅ Your Roblox account has been verified successfully!",
        embeds: [successEmbed],
        components: []
      });
    } catch (updateError) {
      // If the interaction was already replied to (which can happen due to race conditions),
      // try to use followUp instead
      console.warn("Could not update the interaction, it may have already been replied to:", updateError);
      try {
        if (interaction.isButton()) {
          await interaction.followUp({
            content: "✅ Your Roblox account has been verified successfully!",
            ephemeral: true
          });
        }
      } catch (followUpError) {
        console.error("Could not send follow-up message either:", followUpError);
      }
    }
    
  } catch (error) {
    console.error("Error checking verification:", error);
    try {
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
    } catch (updateError) {
      console.warn("Could not update the interaction after error:", updateError);
      // No need to try followUp here as user would be confused
    }
  }
}

// Handle the verify cancel button
async function handleVerifyCancel(
  interaction: ButtonInteraction,
  userId: string,
  storage: IStorage
) {
  try {
    // Get the latest verification attempt
    const attempt = await storage.getLatestVerificationAttempt(userId);
    
    const message = attempt 
      ? "❌ Verification cancelled. Use `/verify` to start a new verification process."
      : "❌ No verification attempt found. Use `/verify` to start the verification process.";
    
    try {
      // Try to update the message
      await interaction.update({
        content: message,
        components: [],
        embeds: []
      });
    } catch (updateError) {
      console.warn("Could not update the cancel interaction:", updateError);
      
      // If we couldn't update, try to send a follow-up instead
      try {
        await interaction.followUp({
          content: message,
          ephemeral: true
        });
      } catch (followUpError) {
        console.error("Could not send follow-up after cancel:", followUpError);
      }
    }
  } catch (error) {
    console.error("Error handling cancel verification:", error);
  }
}
