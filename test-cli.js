/**
 * Test script for CLI
 */

import fs from 'fs';
import { run } from './src/cli.js';

// Create a log file
const logFile = 'cli-test.log';
fs.writeFileSync(logFile, 'Starting test-cli.js\n');

// Override console.log and console.error to write to the log file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function(...args) {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');
  fs.appendFileSync(logFile, message + '\n');
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');
  fs.appendFileSync(logFile, 'ERROR: ' + message + '\n');
  originalConsoleError.apply(console, args);
};

// Simulate CLI arguments
process.argv = [
  'node', // First argument is the node executable
  'src/cli.js', // Second argument is the script path
  'list-tilemaps' // Command
];

// Run the CLI
try {
  fs.appendFileSync(logFile, 'Running CLI...\n');
  run().catch(error => {
    fs.appendFileSync(logFile, 'Error in test-cli.js: ' + error.stack + '\n');
    console.error('Error in test-cli.js:', error);
  });
} catch (error) {
  fs.appendFileSync(logFile, 'Uncaught error in test-cli.js: ' + error.stack + '\n');
  console.error('Uncaught error in test-cli.js:', error);
}
