#!/bin/bash

# Script to build the application for Render.com deployment

echo "Starting build process for Render..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the frontend with Vite
echo "Building frontend with Vite..."
npm run build

# Ensure the dist folder exists with the right files
echo "Checking build output..."
if [ -f "dist/index.js" ]; then
  echo "✅ Build successful - index.js exists"
else
  echo "❌ Build failed - index.js not found"
  exit 1
fi

# Create a startup script that handles ES modules correctly
echo "Creating start script..."
cat > start-on-render.js << EOL
// This file is used to start the application on Render.com
// It ensures that ES modules are properly loaded
import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting application in production mode...');
console.log('Current directory:', __dirname);

// Try to run the built application with proper flags
try {
  // Use spawn to run the application with the correct Node.js flags
  const nodeProcess = spawn('node', [
    '--experimental-modules',
    '--es-module-specifier-resolution=node',
    './dist/index.js'
  ], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit'
  });

  nodeProcess.on('close', (code) => {
    console.log(\`Child process exited with code \${code}\`);
    process.exit(code);
  });

  // Forward signals to the child process
  process.on('SIGINT', () => nodeProcess.kill('SIGINT'));
  process.on('SIGTERM', () => nodeProcess.kill('SIGTERM'));
} catch (error) {
  console.error('Failed to start the application:', error);
  process.exit(1);
}
EOL

echo "Build process completed successfully."
echo "Use 'node --experimental-modules start-on-render.js' as your start command on Render."
chmod +x build-for-render.sh