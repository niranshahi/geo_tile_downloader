/**
 * Geo Tile Downloader
 * A Node.js application to download geographic image tiles
 */

import { loadConfig } from './src/config.js';
import { TileDownloader } from './src/downloader.js';
import { BoundingBoxCalculator } from './src/geo.js';
import { run } from './src/cli.js';

// Export the main modules
export {
  loadConfig,
  TileDownloader,
  BoundingBoxCalculator,
  run
};

// Run the CLI if this file is executed directly
// In ESM, we can use import.meta.url to check if this file is the main module
// We need to handle different path formats on different operating systems
const isMainModule = () => {
  // Get the file path from import.meta.url
  const currentFileUrl = import.meta.url;

  // Get the file path from process.argv[1]
  const mainScriptPath = process.argv[1];

  // Check if the current file is in the main script path
  // This handles different path formats and normalizes them
  return mainScriptPath && (
    // Direct match
    currentFileUrl.includes(mainScriptPath) ||
    // Check for the filename
    currentFileUrl.endsWith('/index.js') ||
    currentFileUrl.endsWith('\\index.js')
  );
};

// Run the CLI if this is the main module
if (isMainModule()) {
  run().catch(error => {
    console.error('Error in CLI:', error);
  });
}
