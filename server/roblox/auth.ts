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
let cookieValid: boolean = true; // Flag to track if cookie is valid

/**
 * Validate Roblox cookie by making a test request
 */
// Type definition for authenticated user response
interface RobloxAuthenticatedUser {
  id: number;
  name: string;
  displayName: string;
}

export async function validateRobloxCookie(): Promise<boolean> {
  if (!hasRobloxAuth) {
    console.warn("No Roblox cookie found in environment variables");
    return false;
  }

  try {
    // Make a test request to check if the cookie is valid
    console.log("Validating Roblox cookie...");
    const response = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers: getAuthHeaders()
    });

    // Check if we got a 200 response indicating valid authentication
    if (response.ok) {
      const userData = await response.json() as RobloxAuthenticatedUser;
      console.log(`Roblox cookie validated! Logged in as user ID: ${userData.id}`);
      cookieValid = true;
      return true;
    } else {
      console.error(`Roblox cookie validation failed. Status: ${response.status}`);
      
      // Try to get more information
      try {
        const errorData = await response.text();
        console.error(`Error details: ${errorData}`);
      } catch (e) {
        // Ignore error reading response
      }
      
      cookieValid = false;
      return false;
    }
  } catch (error) {
    console.error("Error validating Roblox cookie:", error);
    cookieValid = false;
    return false;
  }
}

// Validate cookie on startup
validateRobloxCookie().then(valid => {
  if (valid) {
    console.log("✅ Roblox authentication is ready");
  } else {
    console.warn("⚠️ Roblox authentication is not working, will use public API instead");
  }
});

/**
 * Make an authenticated request to Roblox API
 */
export async function authenticatedFetch(url: string, options: any = {}): Promise<any> {
  if (!hasRobloxAuth) {
    throw new Error("No Roblox authentication cookie available");
  }

  if (!cookieValid) {
    throw new Error("Roblox cookie is invalid or expired");
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

  // Max retries for token issues
  const MAX_RETRIES = 2;
  let retries = 0;

  // Make the request with retries for XSRF issues
  while (retries <= MAX_RETRIES) {
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle XSRF token errors
      if (response.status === 403) {
        const responseXsrfToken = response.headers.get("x-csrf-token");
        if (responseXsrfToken && retries < MAX_RETRIES) {
          console.log(`Received new XSRF token (retry ${retries + 1}), retrying request`);
          xsrfToken = responseXsrfToken;
          headers["X-CSRF-TOKEN"] = xsrfToken;
          retries++;
          continue;
        }
      }

      // Handle unauthorized errors (invalid/expired cookie)
      if (response.status === 401) {
        console.error("Roblox cookie appears to be invalid or expired");
        cookieValid = false;
        throw new Error("Roblox authentication failed - cookie is invalid or expired");
      }

      return response;
    } catch (error) {
      console.error(`Error making authenticated Roblox request (retry ${retries}):`, error);
      if (retries >= MAX_RETRIES) {
        throw error;
      }
      retries++;
    }
  }

  throw new Error(`Failed to make authenticated request after ${MAX_RETRIES} retries`);
}

// Type definition for description response
interface RobloxDescriptionResponse {
  description: string;
}

/**
 * Get a user's profile description using authenticated request
 */
export async function getUserDescription(userId: number): Promise<string | null> {
  try {
    console.log(`Fetching profile description for user ID ${userId} using authenticated request`);
    const response = await authenticatedFetch(`https://users.roblox.com/v1/users/${userId}/description`);
    
    if (!response.ok) {
      console.error(`Failed to get user description: ${response.status} ${response.statusText}`);
      
      // Try to get detailed error response
      try {
        const errorText = await response.text();
        console.error(`Error details: ${errorText}`);
      } catch (e) {
        // Ignore error reading response
      }
      
      // If we got a 401 or 403, the cookie might be invalid
      if (response.status === 401 || response.status === 403) {
        cookieValid = false;
        console.error(`Cookie appears to be invalid or expired (status ${response.status})`);
      }
      
      return null;
    }
    
    const data = await response.json() as RobloxDescriptionResponse;
    
    // Some users might have null or undefined descriptions
    if (data.description === null || data.description === undefined) {
      console.log(`User ${userId} has no profile description`);
      return "";
    }
    
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

// Type definition for search response
interface RobloxUserSearchResponse {
  data: Array<{
    id: number;
    name: string;
    displayName?: string;
  }>;
  totalCount?: number;
}

/**
 * Search for a Roblox user by username using authenticated request
 */
export async function searchUserByUsername(username: string): Promise<{ id: number, name: string } | null> {
  try {
    console.log(`Searching for Roblox user: ${username} using authenticated request`);
    const response = await authenticatedFetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`
    );
    
    if (!response.ok) {
      console.error(`Failed to search for user: ${response.status} ${response.statusText}`);
      
      // Try to get detailed error response
      try {
        const errorText = await response.text();
        console.error(`Error details: ${errorText}`);
      } catch (e) {
        // Ignore error reading response
      }
      
      // If we got a 401 or 403, the cookie might be invalid
      if (response.status === 401 || response.status === 403) {
        cookieValid = false;
        console.error(`Cookie appears to be invalid or expired (status ${response.status})`);
      }
      
      return null;
    }
    
    const data = await response.json() as RobloxUserSearchResponse;
    
    if (!data.data || !Array.isArray(data.data)) {
      console.error(`Invalid search response format for user ${username}`);
      return null;
    }
    
    // Find exact username match (case insensitive)
    const user = data.data.find(user => 
      user.name.toLowerCase() === username.toLowerCase()
    );
    
    if (!user) {
      console.log(`No exact match found for username: ${username}`);
      return null;
    }
    
    console.log(`Found Roblox user: ${user.name} (ID: ${user.id})`);
    return {
      id: user.id,
      name: user.name
    };
  } catch (error) {
    console.error("Error searching for user:", error);
    return null;
  }
}