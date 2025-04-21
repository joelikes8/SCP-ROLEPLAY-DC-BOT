import fetch from "node-fetch";

// Base URLs for Roblox API
const ROBLOX_API_BASE = "https://api.roblox.com";
const USERS_API_BASE = "https://users.roblox.com";
const THUMBNAILS_API_BASE = "https://thumbnails.roblox.com";

// Advanced rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between requests to avoid rate limiting
const MAX_RETRIES = 2; // Maximum number of retries for rate limited requests
const RATE_LIMIT_BACKOFF = 10000; // 10 seconds backoff when rate limited

// Track rate limited responses to implement backoff
let consecutiveRateLimits = 0;
let globalCooldownUntil = 0;

/**
 * Helper function to handle rate limiting with exponential backoff
 */
async function rateLimitedFetch(url: string, options: any = {}, attempt = 0): Promise<any> {
  // Check if we're in a global cooldown period
  const now = Date.now();
  if (now < globalCooldownUntil) {
    const waitTime = globalCooldownUntil - now;
    console.log(`In global cooldown. Waiting ${Math.round(waitTime/1000)}s before trying again...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Enforce minimum time between requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  // Update last request time
  lastRequestTime = Date.now();
  
  // Make the request with improved headers
  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Discord-Verification-Bot/1.0",
    },
    ...options
  };
  
  try {
    const response = await fetch(url, defaultOptions);
    
    // Handle rate limiting
    if (response.status === 429) {
      consecutiveRateLimits++;
      
      // Set a longer global cooldown after multiple consecutive rate limits
      if (consecutiveRateLimits >= 3) {
        const cooldownTime = 60000; // 1 minute cooldown
        console.log(`Multiple rate limits detected. Setting global cooldown for ${cooldownTime/1000}s`);
        globalCooldownUntil = Date.now() + cooldownTime;
        consecutiveRateLimits = 0; // Reset after setting cooldown
        throw new Error(`Roblox API rate limited. Too many consecutive limits, cooling down for ${cooldownTime/1000}s`);
      }
      
      // Retry with backoff if we haven't reached max retries
      if (attempt < MAX_RETRIES) {
        const backoff = RATE_LIMIT_BACKOFF * Math.pow(2, attempt);
        console.log(`Rate limited by Roblox API (attempt ${attempt+1}/${MAX_RETRIES+1}). Backing off for ${backoff/1000}s`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return rateLimitedFetch(url, options, attempt + 1);
      } else {
        console.log(`Maximum retries (${MAX_RETRIES}) reached for rate limited request`);
        consecutiveRateLimits = 0; // Reset for next operation
      }
    } else {
      // Successful non-429 response, reset consecutive rate limits
      consecutiveRateLimits = 0;
    }
    
    return response;
  } catch (error) {
    console.error(`Error in rateLimitedFetch: ${error}`);
    throw error;
  }
}

/**
 * Get a Roblox user by username
 */
export async function getRobloxUserByUsername(username: string): Promise<{ id: number, username: string, avatarUrl?: string | undefined } | null> {
  try {
    // First, try authenticated method if available
    const { hasRobloxAuth, searchUserByUsername } = await import('./auth');
    
    let user;
    if (hasRobloxAuth) {
      console.log(`Using authenticated search for user ${username}`);
      user = await searchUserByUsername(username);
      
      if (!user) {
        console.log(`No user found with authenticated search for ${username}`);
        return null;
      }
    } else {
      // Fall back to rate-limited API
      console.log(`Using public API search (no auth cookie) for user ${username}`);
      const response = await rateLimitedFetch(
        `${USERS_API_BASE}/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`
      );
      
      if (!response.ok) {
        console.error(`Error fetching user: ${response.status} ${response.statusText}`);
        return null;
      }
      
      const data = await response.json() as any;
      
      // Find exact username match
      user = data.data.find((u: any) => 
        u.name.toLowerCase() === username.toLowerCase()
      );
      
      if (!user) {
        return null;
      }
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
      username: user.name || username, // Use the name from the response, or fallback to input username
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
    
    // Import verification function dynamically to avoid circular dependencies
    const { hasRobloxAuth, verifyUserCodeInProfile } = await import('./auth');
    
    // First try using authenticated method if available
    if (hasRobloxAuth) {
      console.log(`Using authenticated verification for user ${user.id} (${username})`);
      const isVerified = await verifyUserCodeInProfile(user.id, code);
      
      if (isVerified) {
        return {
          success: true,
          robloxId: user.id.toString()
        };
      } else {
        return { 
          success: false, 
          message: "Verification code not found in your profile. Please make sure you've saved it in your About section and that Roblox didn't filter it out."
        };
      }
    }
    
    // Fallback to public API if no authentication is available
    console.log(`Using public API for verification (no auth cookie) for user ${username}`);
    const response = await rateLimitedFetch(`${USERS_API_BASE}/v1/users/${user.id}/description`);
    
    if (!response.ok) {
      return { success: false, message: `Failed to fetch user description: ${response.status} ${response.statusText}` };
    }
    
    const data = await response.json() as any;
    const description = data.description;
    
    // Check if the description contains the verification code
    // Convert both to uppercase and remove non-alphanumeric characters for more flexible matching
    const cleanDescription = description.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (!cleanDescription.includes(cleanCode)) {
      return { 
        success: false, 
        message: "Verification code not found in your profile. Please make sure you've saved it in your About section and that Roblox didn't filter it out."
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
    // Try to use authenticated request if available
    const { hasRobloxAuth, authenticatedFetch } = await import('./auth');
    
    const apiUrl = `${THUMBNAILS_API_BASE}/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`;
    
    let response;
    if (hasRobloxAuth) {
      // Use authenticated fetch
      console.log(`Using authenticated fetch for avatar of user ${userId}`);
      response = await authenticatedFetch(apiUrl);
    } else {
      // Fallback to rate-limited fetch
      console.log(`Using public API for avatar (no auth cookie) for user ${userId}`);
      response = await rateLimitedFetch(apiUrl);
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
