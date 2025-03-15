"use strict";
// JaneczekCord Patcher - Main entry point for Discord injection
// This file is the first code executed when Discord starts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron = __importStar(require("electron"));
const electron_1 = require("electron");
const path = __importStar(require("path"));
console.log('[JaneczekCord] Starting up...');
// Get path to the patcher file
const injectorPath = require.main.filename;
// Get path to the original Discord app.asar (renamed to _app.asar during installation)
const asarPath = path.join(path.dirname(injectorPath), '..', '_app.asar');
try {
    // Load the original Discord package.json
    const discordPkg = require(path.join(asarPath, 'package.json'));
    // Set the main filename to point to Discord's original entry point
    require.main.filename = path.join(asarPath, discordPkg.main);
    // Set the app path - this is important for Discord to find its resources
    electron_1.app.setAppPath(asarPath);
    // Create a patched BrowserWindow class to inject our preload script
    class PatchedBrowserWindow extends electron_1.BrowserWindow {
        constructor(options) {
            // Only patch windows that have a preload script and a title
            if (options?.webPreferences?.preload && options.title) {
                // Save original preload
                const originalPreload = options.webPreferences.preload;
                // Replace with our preload
                options.webPreferences.preload = path.join(__dirname, 'preload.js');
                // Disable sandbox to ensure our preload works
                options.webPreferences.sandbox = false;
                // Store original preload path in environment variable for later use
                process.env.DISCORD_ORIGINAL_PRELOAD = originalPreload;
                console.log('[JaneczekCord] Patched window preload:', options.title);
            }
            super(options);
        }
    }
    // Override the BrowserWindow constructor
    Object.assign(PatchedBrowserWindow, electron_1.BrowserWindow);
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
    electron_1.app.on('ready', () => {
        console.log('[JaneczekCord] App is ready');
        try {
            // Patch global settings to force enable DevTools
            if (global.appSettings) {
                global.appSettings.set("DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING", true);
            }
        }
        catch (e) {
            console.error('[JaneczekCord] Failed to patch DevTools settings:', e);
        }
    });
    console.log('[JaneczekCord] Loading original Discord app.asar');
    // Load the original Discord app
    require(path.join(asarPath, discordPkg.main));
}
catch (error) {
    console.error('[JaneczekCord] Critical initialization error:', error);
    // Try to load the original Discord as a fallback
    try {
        console.log('[JaneczekCord] Attempting to load original Discord as fallback...');
        require(path.join(asarPath, 'index.js'));
    }
    catch (fallbackError) {
        console.error('[JaneczekCord] Fallback also failed:', fallbackError);
        console.error('[JaneczekCord] Discord may not start correctly.');
    }
}
//# sourceMappingURL=patcher.js.map