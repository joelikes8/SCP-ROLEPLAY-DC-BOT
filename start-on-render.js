// This file is used to start the application on Render.com
// It handles ES modules properly
import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting application in production mode...');
console.log('Current directory:', __dirname);

// Check if this is running on Render
const isRender = process.env.RENDER === 'true' || process.env.IS_RENDER === 'true' || !!process.env.RENDER_EXTERNAL_URL;
console.log('Is Render environment:', isRender);

// List all directories to debug
console.log('Listing directories:');
exec('find . -type d | sort', (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log('Directories:', stdout);
  
  // Also list the /opt/render directory if this is Render
  if (isRender) {
    exec('find /opt/render -type d -maxdepth 3 | sort', (error, stdout, stderr) => {
      console.log('Render directories:', stdout || 'None found');
    });
  }
});

// Print environment for debugging
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Current working directory:', process.cwd());

// Handle different possible locations for the dist folder
const possiblePaths = [
  './dist/index.js',                    // Local dev
  '/opt/render/project/src/dist/index.js', // Render's path
  '../dist/index.js',                   // Relative path
  `${__dirname}/dist/index.js`,         // Absolute path
];

// Find which path exists
let foundPath = null;
for (const path of possiblePaths) {
  try {
    if (fs.existsSync(path)) {
      console.log(`✅ Found application at: ${path}`);
      foundPath = path;
      break;
    } else {
      console.log(`❌ Path not found: ${path}`);
    }
  } catch (err) {
    console.log(`Error checking path ${path}:`, err.message);
  }
}

// Check if Render's expected directory exists
if (isRender && !fs.existsSync('/opt/render/project/src/dist')) {
  // Create the directory and copy files there
  console.log('Creating Render-expected directory structure...');
  try {
    fs.mkdirSync('/opt/render/project/src/dist', { recursive: true });
    
    // Copy files from local dist to Render's expected location
    if (fs.existsSync('./dist/index.js')) {
      const fileContent = fs.readFileSync('./dist/index.js', 'utf8');
      fs.writeFileSync('/opt/render/project/src/dist/index.js', fileContent);
      console.log('✅ Copied index.js to Render path');
      foundPath = '/opt/render/project/src/dist/index.js';
      
      // If dist/public exists, copy that too
      if (fs.existsSync('./dist/public')) {
        fs.mkdirSync('/opt/render/project/src/dist/public', { recursive: true });
        const files = fs.readdirSync('./dist/public');
        files.forEach(file => {
          const sourcePath = `./dist/public/${file}`;
          const destPath = `/opt/render/project/src/dist/public/${file}`;
          if (fs.statSync(sourcePath).isDirectory()) {
            fs.cpSync(sourcePath, destPath, { recursive: true });
          } else {
            const content = fs.readFileSync(sourcePath);
            fs.writeFileSync(destPath, content);
          }
        });
        console.log('✅ Copied public directory to Render path');
      }
    }
  } catch (err) {
    console.error('Failed to create Render directory structure:', err);
  }
}

// Import and run the actual application
if (foundPath) {
  console.log(`Starting application from: ${foundPath}`);
  try {
    // Dynamic import of the built application
    import(foundPath)
      .then(() => {
        console.log('Application started successfully');
      })
      .catch(error => {
        console.error('Failed to import application:', error);
        process.exit(1);
      });
  } catch (error) {
    console.error('Failed to start the application:', error);
    process.exit(1);
  }
} else {
  console.error('Could not find application entry point in any location');
  process.exit(1);
}