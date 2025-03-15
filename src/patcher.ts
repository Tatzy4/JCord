// JaneczekCord Patcher - Main entry point for Discord injection
// This file is the first code executed when Discord starts

import * as electron from 'electron';
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

// Interface for BrowserWindow options
interface BrowserWindowConstructorOptions {
  webPreferences?: {
    preload?: string;
    sandbox?: boolean;
    [key: string]: any;
  };
  title?: string;
  [key: string]: any;
}

console.log('[JaneczekCord] Starting up...');

// Get path to the patcher file
const injectorPath = require.main!.filename;

// Get path to the original Discord app.asar (renamed to _app.asar during installation)
const asarPath = path.join(path.dirname(injectorPath), '..', '_app.asar');

// Load Discord package.json to find the entry point
interface DiscordPackage {
  main: string;
  [key: string]: any;
}

try {
  // Load the original Discord package.json
  const discordPkg: DiscordPackage = require(path.join(asarPath, 'package.json'));
  
  // Set the main filename to point to Discord's original entry point
  require.main!.filename = path.join(asarPath, discordPkg.main);
  
  // Set the app path - this is important for Discord to find its resources
  (app as any).setAppPath(asarPath);
  
  // Create a patched BrowserWindow class to inject our preload script
  class PatchedBrowserWindow extends BrowserWindow {
    constructor(options?: BrowserWindowConstructorOptions) {
      // Only patch windows that have a preload script and a title
      if (options?.webPreferences?.preload && options.title) {
        // Save original preload
        const originalPreload = options.webPreferences.preload as string;
        
        // Replace with our preload
        options.webPreferences.preload = path.join(__dirname, 'preload.js');
        
        // Disable sandbox to ensure our preload works
        options.webPreferences.sandbox = false;
        
        // Store original preload path in environment variable for later use
        process.env.DISCORD_ORIGINAL_PRELOAD = originalPreload;
        
        console.log('[JaneczekCord] Patched window preload:', options.title);
      }
      
      super(options as any);
    }
  }
  
  // Override the BrowserWindow constructor
  Object.assign(PatchedBrowserWindow, BrowserWindow);
  
  // Fix the name property for compatibility
  Object.defineProperty(PatchedBrowserWindow, 'name', { 
    value: 'BrowserWindow', 
    configurable: true 
  });
  
  // Replace electron exports with our patched version
  const electronPath = require.resolve('electron');
  if (require.cache[electronPath]) {
    delete require.cache[electronPath].exports;
    require.cache[electronPath].exports = {
      ...electron,
      BrowserWindow: PatchedBrowserWindow
    }; 
  }
  
  // Enable DevTools for debugging
  app.on('ready', () => {
    console.log('[JaneczekCord] App is ready');
    try {
      // Patch global settings to force enable DevTools
      if ((global as any).appSettings) {
        (global as any).appSettings.set("DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING", true);
      }
    } catch (e) {
      console.error('[JaneczekCord] Failed to patch DevTools settings:', e);
    }
  });
  
  console.log('[JaneczekCord] Loading original Discord app.asar');
  
  // Load the original Discord app
  require(path.join(asarPath, discordPkg.main));
} catch (error) {
  console.error('[JaneczekCord] Critical initialization error:', error);
  
  // Try to load the original Discord as a fallback
  try {
    console.log('[JaneczekCord] Attempting to load original Discord as fallback...');
    require(path.join(asarPath, 'index.js'));
  } catch (fallbackError) {
    console.error('[JaneczekCord] Fallback also failed:', fallbackError);
    console.error('[JaneczekCord] Discord may not start correctly.');
  }
}