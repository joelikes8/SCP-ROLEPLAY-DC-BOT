import crypto from "crypto";

/**
 * Generate a random verification code for Roblox verification
 * Using a format that's less likely to be filtered by Roblox
 */
export function generateVerificationCode(): string {
  // Use only letters to avoid Roblox filtering issues
  // Avoiding numbers and special characters that might be filtered
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'VERIFY';
  
  // Add 6 random letters
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  
  return result;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds === 0) return "0 seconds";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }
  
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);
  }
  
  return parts.join(", ");
}
