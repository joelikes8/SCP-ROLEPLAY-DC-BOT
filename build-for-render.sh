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

echo "Build process completed successfully."
echo "To start the application, use 'node --experimental-modules start-on-render.js'"