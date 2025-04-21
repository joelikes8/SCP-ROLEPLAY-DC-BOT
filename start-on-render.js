// This file is used to start the application on Render.com
// It handles ES modules properly
import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting application in production mode...');
console.log('Current directory:', __dirname);
console.log('Files in current directory:', fs.readdirSync('.'));
console.log('Files in dist directory:', fs.existsSync('./dist') ? fs.readdirSync('./dist') : 'dist directory not found');

// Import and run the actual application
try {
  // Dynamic import of the built application
  import('./dist/index.js')
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