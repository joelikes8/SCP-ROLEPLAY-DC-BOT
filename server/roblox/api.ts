import fetch from "node-fetch";

// Base URLs for Roblox API
const ROBLOX_API_BASE = "https://api.roblox.com";
const USERS_API_BASE = "https://users.roblox.com";
const THUMBNAILS_API_BASE = "https://thumbnails.roblox.com";

/**
 * Get a Roblox user by username
 */
export async function getRobloxUserByUsername(username: string): Promise<{ id: number, username: string, avatarUrl?: string } | null> {
  try {
    // Make API request to get user
    const response = await fetch(`${USERS_API_BASE}/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    
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
    
    // Get avatar URL
    const avatarUrl = await getRobloxAvatar(user.id);
    
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
    const response = await fetch(`${USERS_API_BASE}/v1/users/${user.id}/description`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
      return { success: false, message: "Failed to fetch user description" };
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
    const response = await fetch(`${THUMBNAILS_API_BASE}/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
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
