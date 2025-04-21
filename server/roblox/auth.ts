import fetch from "node-fetch";

// Roblox cookie from environment variables
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;

// Check if we have a Roblox cookie
export const hasRobloxAuth = !!ROBLOX_COOKIE;

// Common headers for authenticated requests
const getAuthHeaders = () => {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`
  };
};

// XSRF token handling
let xsrfToken: string | null = null;

/**
 * Make an authenticated request to Roblox API
 */
export async function authenticatedFetch(url: string, options: any = {}): Promise<any> {
  if (!hasRobloxAuth) {
    throw new Error("No Roblox authentication cookie available");
  }

  // Set up authenticated headers
  const headers = {
    ...getAuthHeaders(),
    ...options.headers
  };

  // Add XSRF token if we have one
  if (xsrfToken) {
    headers["X-CSRF-TOKEN"] = xsrfToken;
  }

  // Make the request
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle XSRF token errors
    if (response.status === 403) {
      const responseXsrfToken = response.headers.get("x-csrf-token");
      if (responseXsrfToken) {
        console.log("Received new XSRF token, retrying request");
        xsrfToken = responseXsrfToken;
        
        // Retry the request with the new token
        return authenticatedFetch(url, options);
      }
    }

    return response;
  } catch (error) {
    console.error("Error making authenticated Roblox request:", error);
    throw error;
  }
}

/**
 * Get a user's profile description using authenticated request
 */
export async function getUserDescription(userId: number): Promise<string | null> {
  try {
    const response = await authenticatedFetch(`https://users.roblox.com/v1/users/${userId}/description`);
    
    if (!response.ok) {
      console.error(`Failed to get user description: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    return data.description;
  } catch (error) {
    console.error("Error fetching user description:", error);
    return null;
  }
}

/**
 * Verify if a user has a code in their profile
 */
export async function verifyUserCodeInProfile(userId: number, code: string): Promise<boolean> {
  try {
    const description = await getUserDescription(userId);
    
    if (!description) {
      return false;
    }
    
    // Clean both the description and code for a more flexible match
    const cleanDescription = description.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    return cleanDescription.includes(cleanCode);
  } catch (error) {
    console.error("Error verifying user code:", error);
    return false;
  }
}

/**
 * Search for a Roblox user by username using authenticated request
 */
export async function searchUserByUsername(username: string): Promise<{ id: number, name: string } | null> {
  try {
    const response = await authenticatedFetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`
    );
    
    if (!response.ok) {
      console.error(`Failed to search for user: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    // Find exact username match (case insensitive)
    const user = data.data.find((user: any) => 
      user.name.toLowerCase() === username.toLowerCase()
    );
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      name: user.name
    };
  } catch (error) {
    console.error("Error searching for user:", error);
    return null;
  }
}