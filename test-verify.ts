import { verifyUserWithCode } from "./server/roblox/api";

async function testVerification() {
  try {
    // Replace with the actual username and code you used
    const username = "Collinplaysroblox707"; 
    const code = "ABC-123"; // Replace with the actual verification code you used
    
    console.log(`Testing verification for user "${username}" with code "${code}"...`);
    
    const result = await verifyUserWithCode(username, code);
    
    console.log("Verification result:", result);
    
    if (!result.success) {
      console.log("Verification failed. Additional information:");
      console.log("Message:", result.message);
    }
  } catch (error) {
    console.error("Error during verification test:", error);
  }
}

testVerification().then(() => {
  console.log("Test complete");
});