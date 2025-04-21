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

# Create the Render-expected directory structure
echo "Creating Render directory structure..."
mkdir -p /opt/render/project/src/dist
mkdir -p /opt/render/project/src/dist/public

# Copy files to the Render expected location
echo "Copying files to Render paths..."
cp dist/index.js /opt/render/project/src/dist/
if [ -d "dist/public" ]; then
  cp -r dist/public/* /opt/render/project/src/dist/public/
  echo "✅ Copied public directory"
fi

echo "Build process completed successfully."
echo "To start the application, use 'node --experimental-modules start-on-render.js'"