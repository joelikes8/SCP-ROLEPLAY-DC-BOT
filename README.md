# SCP ROLEPLAY Discord Bot

A Discord bot designed to streamline Roblox group management and user verification processes with advanced interaction capabilities.

## Key Features
- Discord integration for Roblox group verification
- Robust Roblox API interaction
- Patrol tracking system
- Error-resilient verification mechanism
- Typescript-based implementation

## Setup
1. Install dependencies with `npm install`
2. Configure your environment variables:
   - `DISCORD_TOKEN`: Your Discord bot token
   - `ROBLOX_COOKIE`: (Optional) Roblox authentication cookie for enhanced verification
   - `DATABASE_URL`: PostgreSQL database connection string
3. Start the bot with `npm run dev`

## Commands
- `/verify <username>`: Verify a user's Roblox account
- `/reverify`: Reverify with a different Roblox account
- `/patrol`: Start/stop patrol tracking

## Tech Stack
- Node.js & TypeScript
- Express backend with Vite frontend
- Discord.js for Discord integration
- PostgreSQL with Drizzle ORM