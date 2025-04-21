import fetch from "node-fetch";

// Base URLs for Roblox API
const ROBLOX_API_BASE = "https://api.roblox.com";
const USERS_API_BASE = "https://users.roblox.com";
const THUMBNAILS_API_BASE = "https://thumbnails.roblox.com";

// Simple rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

/**
 * Helper function to handle rate limiting
 */
async function rateLimitedFetch(url: string, options: any = {}) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  // If we've made a request recently, wait before making another
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  // Update last request time
  lastRequestTime = Date.now();
  
  // Make the request with default headers
  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Discord-Bot/1.0"
    },
    ...options
  };
  
  return fetch(url, defaultOptions);
}

/**
 * Get a Roblox user by username
 */
export async function getRobloxUserByUsername(username: string): Promise<{ id: number, username: string, avatarUrl?: string | undefined } | null> {
  try {
    // Make API request to get user
    const response = await rateLimitedFetch(
      `${USERS_API_BASE}/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`
    );
    
    // Handle rate limiting explicitly
    if (response.status === 429) {
      console.log("Rate limited by Roblox API, waiting and retrying...");
      // Wait 2 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getRobloxUserByUsername(username);
    }
    
    if (!response.ok) {
      console.error(`Error fetching user: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json() as any;
    
    // Find exact username match
    const user = data.data.find((user: any) => 
      user.name.toLowerCase() === username.toLowerCase()
    );
    
    if (!user) {
      return null;
    }
    
    // Get avatar URL, but make it optional - don't let avatar issues prevent verification
    let avatarUrl: string | undefined = undefined;
    try {
      const fetchedAvatar = await getRobloxAvatar(user.id.toString());
      if (fetchedAvatar) {
        avatarUrl = fetchedAvatar;
      }
    } catch (avatarError) {
      console.error("Could not fetch avatar, continuing without it:", avatarError);
    }
    
    return {
      id: user.id,
      username: user.name,
      avatarUrl
    };
  } catch (error) {
    console.error("Error fetching Roblox user:", error);
    return null;
  }
}

/**
 * Verify a user has the verification code in their profile
 */
export async function verifyUserWithCode(username: string, code: string): Promise<{ success: boolean, message?: string, robloxId?: string }> {
  try {
    // First, get the user ID
    const user = await getRobloxUserByUsername(username);
    
    if (!user) {
      return { success: false, message: "User not found" };
    }
    
    // Then, get the user's profile description
    const response = await rateLimitedFetch(`${USERS_API_BASE}/v1/users/${user.id}/description`);
    
    // Handle rate limiting explicitly
    if (response.status === 429) {
      console.log("Rate limited by Roblox API while fetching description, waiting and retrying...");
      // Wait 2 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 2000));
      return verifyUserWithCode(username, code);
    }
    
    if (!response.ok) {
      return { success: false, message: `Failed to fetch user description: ${response.status} ${response.statusText}` };
    }
    
    const data = await response.json() as any;
    const description = data.description;
    
    // Check if the description contains the verification code
    if (!description.includes(code)) {
      return { 
        success: false, 
        message: "Verification code not found in your profile. Please make sure you've saved it in your About section."
      };
    }
    
    // Success - return user ID
    return {
      success: true,
      robloxId: user.id.toString()
    };
  } catch (error) {
    console.error("Error verifying user with code:", error);
    return { success: false, message: "An error occurred during verification" };
  }
}

/**
 * Get a Roblox user's avatar URL
 */
export async function getRobloxAvatar(userId: string): Promise<string | null> {
  try {
    const response = await rateLimitedFetch(
      `${THUMBNAILS_API_BASE}/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`
    );
    
    // Handle rate limiting explicitly
    if (response.status === 429) {
      console.log("Rate limited by Roblox API while fetching avatar, waiting and retrying...");
      // Wait 2 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getRobloxAvatar(userId);
    }
    
    if (!response.ok) {
      console.warn(`Could not fetch avatar: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json() as any;
    
    if (data.data && data.data.length > 0) {
      return data.data[0].imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching Roblox avatar:", error);
    return null;
  }
}
