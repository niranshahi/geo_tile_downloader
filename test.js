import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the config file
const configPath = path.resolve(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Print the config
console.log('Config loaded successfully:');
console.log('Tile Maps:');
for (const tileMap of config.TileMaps) {
  console.log(`- ${tileMap.Name}: ${tileMap.Url}`);
}

// Set default tile cache folder
if (!config.TileCacheFolder || config.TileCacheFolder.trim() === '') {
  config.TileCacheFolder = path.resolve(__dirname, 'tile_cache');
  console.log(`Setting default tile cache folder: ${config.TileCacheFolder}`);
}

// Ensure the tile cache folder exists
fs.ensureDirSync(config.TileCacheFolder);
console.log(`Tile cache folder created: ${config.TileCacheFolder}`);

console.log('Test completed successfully');
