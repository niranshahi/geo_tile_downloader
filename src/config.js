/**
 * Configuration module for the Geo Tile Downloader
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load configuration from config.json
 * @returns {Object} The configuration object
 */
function loadConfig() {
  try {
    const configPath = path.resolve(process.cwd(), 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    // Set default tile cache folder if not specified
    if (!config.TileCacheFolder || config.TileCacheFolder.trim() === '') {
      config.TileCacheFolder = path.resolve(process.cwd(), 'tile_cache');
    }

    // Ensure the tile cache folder exists
    fs.ensureDirSync(config.TileCacheFolder);

    return config;
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Get a tile map configuration by name
 * @param {Object} config The configuration object
 * @param {string} name The name of the tile map
 * @returns {Object} The tile map configuration
 */
function getTileMapByName(config, name) {
  const tileMap = config.TileMaps.find(tm => tm.Name === name);
  if (!tileMap) {
    throw new Error(`Tile map "${name}" not found in configuration`);
  }
  return tileMap;
}

export { loadConfig, getTileMapByName };
