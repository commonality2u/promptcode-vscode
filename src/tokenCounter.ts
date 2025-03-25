import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';


// Interface for cache entries
interface TokenCacheEntry {
  count: number;
  mtime: number;
  size: number;
  timestamp: number;
}

// Structure for the disk cache file
interface DiskCache {
  version: string;
  extensionVersion: string;
  entries: Record<string, TokenCacheEntry>;
  lastUpdated: number;
}

// Cache for token counts to avoid recalculating
const tokenCache = new Map<string, TokenCacheEntry>();

// Path to the disk cache file
let diskCachePath: string | undefined;

// Extension version
let extensionVersion: string | undefined;

// Save debounce timer
let saveCacheTimer: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 5000; // Save at most once every 5 seconds

/**
 * Initialize the token counter with a storage path
 * @param globalStoragePath The extension's global storage path
 */
export function initializeTokenCounter(globalStoragePath: string): void {
  // Ensure the storage directory exists
  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath, { recursive: true });
  }
  
  diskCachePath = path.join(globalStoragePath, 'token-cache.json');
  console.log(`Token cache will be stored at: ${diskCachePath}`);
  
  // Get extension version
  try {
    const extension = vscode.extensions.getExtension('promptcode');
    if (extension) {
      extensionVersion = extension.packageJSON.version;
      console.log(`Extension version: ${extensionVersion}`);
    } else {
      // Try to find the extension by inferring the publisher
      const allExtensions = vscode.extensions.all;
      for (const ext of allExtensions) {
        if (ext.id.toLowerCase().endsWith('.promptcode')) {
          extensionVersion = ext.packageJSON.version;
          console.log(`Found extension version: ${extensionVersion}`);
          break;
        }
      }
      if (!extensionVersion) {
        console.warn('Could not determine extension version, cache version validation will be disabled');
      }
    }
  } catch (error) {
    console.warn('Error getting extension version:', error);
  }
  
  loadCacheFromDisk().catch(err => {
    console.error('Failed to load token cache from disk:', err);
  });
}

/**
 * Counts the number of tokens in a file using gpt-tokenizer
 * @param filePath Path to the file
 * @returns Number of tokens in the file
 */
export async function countTokensInFile(filePath: string): Promise<number> {
    try {
        // Check if file exists and is readable
        await fs.promises.access(filePath, fs.constants.R_OK);
        
        // Read file content
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        // Count tokens using gpt-tokenizer
        const tokenCount = countTokens(content);
        
        return tokenCount;
    } catch (error) {
        console.error(`Error counting tokens in file ${filePath}:`, error);
        return 0;
    }
}

/**
 * Checks if a cached count for a file is still valid
 * @param filePath Path to the file
 * @param stats File stats
 * @returns True if cache is valid, false otherwise
 */
function isCacheValid(filePath: string, stats: fs.Stats): boolean {
    const cached = tokenCache.get(filePath);
    if (!cached) {
        return false;
    }
    
    // Check if file modification time or size has changed
    return cached.mtime === stats.mtimeMs && cached.size === stats.size;
}

/**
 * Counts tokens in a file with caching based on modification time and size
 * @param filePath Path to the file
 * @returns Number of tokens in the file
 */
export async function countTokensWithCache(filePath: string): Promise<number> {
    try {
        // Get file stats to check modification time and size
        const stats = await fs.promises.stat(filePath);
        
        // Check if we have a valid cached count
        if (isCacheValid(filePath, stats)) {
            return tokenCache.get(filePath)!.count;
        }
        
        // No valid cache, count tokens
        const count = await countTokensInFile(filePath);
        
        // Update cache with new count and file metadata
        tokenCache.set(filePath, { 
            count, 
            mtime: stats.mtimeMs,
            size: stats.size,
            timestamp: Date.now()
        });
        
        // Schedule cache save to disk
        scheduleCacheSave();
        
        return count;
    } catch (error) {
        console.error(`Error counting tokens with cache for file ${filePath}:`, error);
        
        // If there's an error with stats, try direct counting
        try {
            return await countTokensInFile(filePath);
        } catch (innerError) {
            console.error(`Failed fallback token count for ${filePath}:`, innerError);
            return 0;
        }
    }
}

/**
 * Schedule saving the cache to disk in a debounced manner
 */
function scheduleCacheSave(): void {
  if (saveCacheTimer) {
    clearTimeout(saveCacheTimer);
  }
  
  saveCacheTimer = setTimeout(() => {
    saveCacheToDisk().catch(err => {
      console.error('Failed to save token cache to disk:', err);
    });
    saveCacheTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Save the current memory cache to disk
 */
async function saveCacheToDisk(): Promise<void> {
  if (!diskCachePath) {
    console.warn('No disk cache path set, cannot save token cache');
    return;
  }
  
  try {
    // Create directory if it doesn't exist
    const cacheDir = path.dirname(diskCachePath);
    await fs.promises.mkdir(cacheDir, { recursive: true });
    
    // Convert the Map to a Record for JSON serialization
    const entries: Record<string, TokenCacheEntry> = {};
    tokenCache.forEach((value, key) => {
      entries[key] = value;
    });
    
    // Create cache data structure
    const cacheData: DiskCache = {
      version: '1.0',
      extensionVersion: extensionVersion || '0.0.0',
      entries,
      lastUpdated: Date.now()
    };
    
    // Write to disk
    await fs.promises.writeFile(
      diskCachePath, 
      JSON.stringify(cacheData, null, 2), 
      'utf8'
    );
    
    console.log(`Token cache saved to disk (${Object.keys(entries).length} entries)`);
  } catch (error) {
    console.error('Error saving token cache to disk:', error);
    throw error;
  }
}

/**
 * Load the cache from disk
 */
async function loadCacheFromDisk(): Promise<void> {
  if (!diskCachePath) {
    console.warn('No disk cache path set, cannot load token cache');
    return;
  }
  
  try {
    // Check if cache file exists
    await fs.promises.access(diskCachePath, fs.constants.R_OK);
    
    // Read and parse cache file
    const cacheContent = await fs.promises.readFile(diskCachePath, 'utf8');
    const cacheData = JSON.parse(cacheContent) as DiskCache;
    
    // Validate cache version and extension version
    if (cacheData.version === '1.0') {
      // Check if extension version matches or if we should invalidate the cache
      if (!cacheData.extensionVersion || !extensionVersion || 
          cacheData.extensionVersion !== extensionVersion) {
        console.log(`Extension version mismatch or missing (cache: ${cacheData.extensionVersion}, current: ${extensionVersion}). Invalidating cache.`);
        // Clear the current cache - we won't load anything
        tokenCache.clear();
        return;
      }
      
      // Clear current cache
      tokenCache.clear();
      
      // Load entries into memory cache
      let loadedCount = 0;
      Object.entries(cacheData.entries).forEach(([filePath, entry]) => {
        // Only import entries for files that still exist
        if (fs.existsSync(filePath)) {
          tokenCache.set(filePath, entry);
          loadedCount++;
        }
      });
      
      console.log(`Loaded ${loadedCount} token cache entries from disk`);
    } else {
      console.warn(`Unsupported token cache version: ${cacheData.version}`);
    }
  } catch (error) {
    // Ignore if file doesn't exist yet
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.log('No token cache file found, starting with empty cache');
    } else {
      console.error('Error loading token cache from disk:', error);
      throw error;
    }
  }
}

/**
 * Clears the token cache (both memory and disk)
 */
export function clearTokenCache(): void {
    // Clear memory cache
    tokenCache.clear();
    console.log('Token cache cleared from memory');
    
    // Clear disk cache if available
    if (diskCachePath) {
      fs.unlink(diskCachePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error('Error deleting token cache file:', err);
        } else {
          console.log('Token cache file deleted from disk');
        }
      });
    }
} 