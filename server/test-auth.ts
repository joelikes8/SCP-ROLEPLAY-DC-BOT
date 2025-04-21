// Test script to verify Roblox authentication

async function testRobloxAuth() {
  try {
    // Get cookie from environment
    const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
    
    console.log("======= ROBLOX AUTHENTICATION TEST =======");
    console.log("ROBLOX_COOKIE exists:", !!ROBLOX_COOKIE);
    
    if (!ROBLOX_COOKIE) {
      console.error("No ROBLOX_COOKIE environment variable found!");
      console.log("Please make sure the ROBLOX_COOKIE environment variable is set.");
      return;
    }
    
    console.log("ROBLOX_COOKIE length:", ROBLOX_COOKIE.length);
    
    // Test headers
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`
    };
    
    console.log("Testing authentication...");
    
    // Make an authenticated request to check if the cookie is valid
    const response = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers
    });
    
    console.log("Response status:", response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log("SUCCESS! Authentication successful. User data:", data);
    } else {
      console.error("FAILED! Authentication failed with status:", response.status, response.statusText);
      
      try {
        const errorText = await response.text();
        console.error("Error details:", errorText);
      } catch (e) {
        console.error("Could not read error details");
      }
      
      // Provide some guidance on common issues
      console.log("\nPossible issues:");
      console.log("1. The cookie may be expired - Roblox cookies expire regularly");
      console.log("2. The cookie format may be incorrect - it should be the value without the .ROBLOSECURITY= prefix");
      console.log("3. The cookie may be from a different environment than what Roblox expects");
      console.log("4. There may be network issues preventing the connection to Roblox");
    }
    
    console.log("\n=== Additional Authentication Tests ===");
    
    // Try another endpoint to verify search works
    try {
      console.log("Testing user search...");
      const searchResponse = await fetch(
        "https://users.roblox.com/v1/users/search?keyword=ROBLOX&limit=10",
        { headers }
      );
      
      console.log("Search response status:", searchResponse.status);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        console.log("Search successful, found users:", searchData.data.length);
      } else {
        console.error("Search failed with status:", searchResponse.status);
      }
    } catch (e) {
      console.error("Error during search test:", e);
    }
    
    console.log("======= TEST COMPLETE =======");
  } catch (error) {
    console.error("Error in test:", error);
  }
}

// Run the test
testRobloxAuth();