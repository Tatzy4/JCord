// JaneczekCord Preload Script (Aggressive webpack capture)
// Main entry point for client-side code

import { contextBridge, ipcRenderer } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Simple logging to avoid styling issues
function safeLog(area: string, message: string, ...args: any[]): void {
  console.log(`[JaneczekCord][${area}] ${message}`, ...args);
}

// Direct webpack and React capturing (aggressive approach)
function captureDiscordInternals() {
  safeLog('Capture', 'Starting aggressive module capture');
  
  // Initialize a global object for our data
  const JC = (window as any).JC = (window as any).JC || {
    version: '1.0.0',
    React: null,
    ReactDOM: null,
    webpackChunks: [],
    webpackRequire: null,
    modules: { modules: {}, components: {} },
    status: () => ({
      webpackReady: !!JC.webpackRequire,
      reactLoaded: !!JC.React,
      reactDOMLoaded: !!JC.ReactDOM,
      reactVersion: JC.React?.version || 'Not loaded',
      moduleCount: Object.keys(JC.modules?.modules || {}).length || 0,
      componentCount: Object.keys(JC.modules?.components || {}).length || 0
    })
  };
  
  // Function to find React in a module
  const findReactInModule = (exports: any, id: string | number) => {
    if (!exports) return false;
    
    // Check for React
    if (exports.useState && exports.useEffect && exports.createElement && exports.version) {
      safeLog('Capture', `Found React v${exports.version} in module ${id}`);
      JC.React = exports;
      (window as any).React = exports;
      return true;
    }
    
    // Check for ReactDOM
    if (exports.render && exports.createPortal && exports.findDOMNode) {
      safeLog('Capture', `Found ReactDOM in module ${id}`);
      JC.ReactDOM = exports;
      (window as any).ReactDOM = exports;
      return true;
    }
    
    // Check for React component if it has a displayName
    if (typeof exports === 'object' || typeof exports === 'function') {
      try {
        // Direct component with displayName
        if (exports.displayName && typeof exports === 'function') {
          JC.modules.components[exports.displayName] = exports;
        }
        
        // Default export with displayName
        if (exports.default?.displayName && typeof exports.default === 'function') {
          JC.modules.components[exports.default.displayName] = exports.default;
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    return false;
  };
  
  // Function to process a webpack module
  const processModule = (id: string | number, mod: any) => {
    if (!mod || !mod.exports) return;
    
    // Try to find React in this module
    findReactInModule(mod.exports, id);
    
    // Store module in our registry
    JC.modules.modules[id] = mod.exports;
    
    // Check for nested modules
    if (typeof mod.exports === 'object') {
      for (const key in mod.exports) {
        const nestedExport = mod.exports[key];
        if (nestedExport && (typeof nestedExport === 'object' || typeof nestedExport === 'function')) {
          // Check if this nested export is React
          findReactInModule(nestedExport, `${id}.${key}`);
        }
      }
    }
  };
  
  // Method 1: Intercept webpackChunkdiscord_app
  const interceptWebpackChunks = () => {
    if (!(window as any).webpackChunkdiscord_app) {
      return false;
    }
    
    safeLog('Capture', 'Found webpackChunkdiscord_app, intercepting...');
    
    const webpackChunk = (window as any).webpackChunkdiscord_app;
    
    // Track if webpack require was found
    let foundRequire = false;
    
    // Store the original push method
    const originalPush = webpackChunk.push;
    
    // Replace with our version
    webpackChunk.push = function(...args: any[]) {
      // Call original method
      const result = originalPush.apply(this, args);
      
      // Process the chunk
      if (args[0] && Array.isArray(args[0])) {
        try {
          const [modules, runtimeChunk] = args[0];
          
          // Look for webpack require in the runtime chunk
          if (runtimeChunk && typeof runtimeChunk === 'object') {
            for (const id in runtimeChunk) {
              const maybeRequire = runtimeChunk[id];
              if (typeof maybeRequire === 'function' && maybeRequire.m && maybeRequire.c) {
                if (!foundRequire) {
                  safeLog('Capture', `Found webpack require in chunk ${id}`);
                  JC.webpackRequire = maybeRequire;
                  foundRequire = true;
                  
                  // Process all loaded modules
                  for (const moduleId in maybeRequire.c) {
                    const mod = maybeRequire.c[moduleId];
                    if (mod && mod.exports) {
                      processModule(moduleId, mod);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore errors during processing
        }
      }
      
      // Save this chunk for later examination
      JC.webpackChunks.push(args[0]);
      
      return result;
    };
    
    // Process any existing chunks
    if (webpackChunk.length > 0) {
      safeLog('Capture', `Processing ${webpackChunk.length} existing chunks`);
      webpackChunk.forEach((chunk: any) => {
        try {
          webpackChunk.push.apply(webpackChunk, [chunk]);
        } catch (e) {
          // Ignore errors
        }
      });
    }
    
    return true;
  };
  
  // Method 2: Look for webpack in window properties
  const findWebpackInWindow = () => {
    for (const key in window) {
      try {
        // Look for properties that might be webpack modules
        if (key.includes('webpack') || key.includes('__REACT')) {
          const value = (window as any)[key];
          if (value && typeof value === 'object') {
            safeLog('Capture', `Examining window.${key}`);
            
            // Check if this might be a webpack cache
            if (value.c && value.m && typeof value === 'function') {
              safeLog('Capture', `Found potential webpack in window.${key}`);
              JC.webpackRequire = value;
              
              // Process modules
              for (const moduleId in value.c) {
                const mod = value.c[moduleId];
                if (mod && mod.exports) {
                  processModule(moduleId, mod);
                }
              }
            }
          }
        }
      } catch (e) {
        // Ignore errors accessing window properties
      }
    }
  };
  
  // Method 3: Find React in DOM nodes
  const findReactInDOM = () => {
    // Wait for document to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', findReactInDOM);
      return;
    }
    
    setTimeout(() => {
      if (JC.React) return; // Already found
      
      safeLog('Capture', 'Trying to find React in DOM nodes');
      
      // Try to find React instance in app elements
      const appNodes = [
        document.querySelector('#app-mount'),
        document.querySelector('[class^="app-"]'),
        document.querySelector('[class^="baseLayer-"]')
      ];
      
      for (const node of appNodes) {
        if (!node) continue;
        
        // Look for React fiber
        for (const key in node) {
          try {
            if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
              const fiber = (node as any)[key];
              if (!fiber) continue;
              
              safeLog('Capture', `Found React fiber in DOM: ${key}`);
              
              // Walk up the fiber tree
              let current = fiber;
              while (current) {
                // Look for React in stateNode
                if (current.stateNode && current.stateNode._reactInternals) {
                  const context = current.stateNode._reactInternals._context;
                  if (context && context._currentValue) {
                    const possibleReact = context._currentValue;
                    if (possibleReact.createElement && possibleReact.useState) {
                      safeLog('Capture', 'Found React in fiber context!');
                      JC.React = possibleReact;
                      (window as any).React = possibleReact;
                      break;
                    }
                  }
                }
                
                // Move up the tree
                current = current.return;
              }
            }
          } catch (e) {
            // Ignore errors
          }
        }
      }
    }, 1000);
  };
  
  // Start capturing using multiple methods
  interceptWebpackChunks();
  findWebpackInWindow();
  findReactInDOM();
  
  // Set up periodic retries
  let retryCount = 0;
  const maxRetries = 10;
  
  const retryInterval = setInterval(() => {
    retryCount++;
    if (retryCount >= maxRetries) {
      clearInterval(retryInterval);
      safeLog('Capture', 'Giving up after maximum retries');
      return;
    }
    
    safeLog('Capture', `Retry attempt ${retryCount}/${maxRetries}`);
    
    if (!JC.webpackRequire) {
      interceptWebpackChunks();
      findWebpackInWindow();
    }
    
    if (!JC.React) {
      findReactInDOM();
    }
    
    // If we found everything, stop retrying
    if (JC.webpackRequire && JC.React && JC.ReactDOM) {
      clearInterval(retryInterval);
      safeLog('Capture', 'Successfully captured all required modules!');
    }
  }, 2000);
}

// Initialize a minimal global object
(window as any).JC = {
  version: '1.0.0',
  React: null,
  ReactDOM: null,
  status: () => {
    const JC = (window as any).JC;
    return {
      webpackReady: !!JC.webpackRequire,
      reactLoaded: !!JC.React,
      reactDOMLoaded: !!JC.ReactDOM,
      reactVersion: JC.React?.version || 'Not loaded',
      moduleCount: Object.keys(JC.modules?.modules || {}).length || 0,
      componentCount: Object.keys(JC.modules?.components || {}).length || 0
    };
  }
};

// Wait for document to be ready
function whenDocumentReady(callback: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

// Add diagnostic UI when document is ready
function addDiagnosticUI(): void {
  safeLog('UI', 'Adding diagnostic UI');
  
  // Wait a bit to ensure Discord's UI has started loading
  setTimeout(() => {
    try {
      // Create status button
      const statusButton = document.createElement('div');
      statusButton.textContent = 'JC Status';
      statusButton.style.position = 'fixed';
      statusButton.style.bottom = '10px';
      statusButton.style.right = '10px';
      statusButton.style.background = '#5865F2';
      statusButton.style.color = 'white';
      statusButton.style.padding = '8px 12px';
      statusButton.style.borderRadius = '4px';
      statusButton.style.zIndex = '9999';
      statusButton.style.cursor = 'pointer';
      statusButton.style.fontFamily = 'Whitney, sans-serif';
      statusButton.style.fontSize = '14px';
      
      // Status panel (hidden initially)
      const statusPanel = document.createElement('div');
      statusPanel.style.position = 'fixed';
      statusPanel.style.bottom = '50px';
      statusPanel.style.right = '10px';
      statusPanel.style.width = '300px';
      statusPanel.style.background = '#2f3136';
      statusPanel.style.color = 'white';
      statusPanel.style.padding = '10px';
      statusPanel.style.borderRadius = '5px';
      statusPanel.style.zIndex = '9999';
      statusPanel.style.fontFamily = 'Whitney, sans-serif';
      statusPanel.style.fontSize = '14px';
      statusPanel.style.display = 'none';
      statusPanel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
      
      // Function to update status
      const updateStatus = () => {
        const JC = (window as any).JC;
        const status = JC.status();
        
        statusPanel.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">JaneczekCord Status</div>
          <div>Webpack Ready: ${status.webpackReady ? '✅' : '❌'}</div>
          <div>React Loaded: ${status.reactLoaded ? '✅' : '❌'}</div>
          <div>React Version: ${status.reactVersion}</div>
          <div>ReactDOM Loaded: ${status.reactDOMLoaded ? '✅' : '❌'}</div>
          <div>Modules Count: ${status.moduleCount}</div>
          <div>Components Count: ${status.componentCount}</div>
          <button id="jc-force-capture" style="margin-top: 10px; padding: 6px 12px; background: #5865F2; color: white; border: none; border-radius: 3px; cursor: pointer;">
            Force Capture
          </button>
          <button id="jc-refresh-status" style="margin-top: 10px; padding: 6px 12px; background: #4e5d94; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">
            Refresh
          </button>
        `;
        
        // Add handlers
        setTimeout(() => {
          document.getElementById('jc-refresh-status')?.addEventListener('click', () => {
            updateStatus();
          });
          
          document.getElementById('jc-force-capture')?.addEventListener('click', () => {
            captureDiscordInternals();
            setTimeout(updateStatus, 1000);
          });
        }, 0);
      };
      
      // Toggle status panel
      statusButton.addEventListener('click', () => {
        const isVisible = statusPanel.style.display !== 'none';
        statusPanel.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
          updateStatus();
        }
      });
      
      // Add elements to DOM
      document.body.appendChild(statusButton);
      document.body.appendChild(statusPanel);
      
      safeLog('UI', 'Diagnostic UI added successfully');
    } catch (err) {
      safeLog('UI', `Error adding diagnostic UI: ${err}`);
    }
  }, 3000);
}

// Main entry point
try {
  safeLog('Preload', 'Preload script starting');
  
  // Load Discord's original preload if available
  const originalPreload = process.env.DISCORD_ORIGINAL_PRELOAD;
  if (originalPreload) {
    safeLog('Preload', `Loading Discord original preload: ${originalPreload}`);
    require(originalPreload);
  }
  
  // Try to capture Discord internals
  captureDiscordInternals();
  
  // Add diagnostic UI when document is ready
  whenDocumentReady(addDiagnosticUI);
  
  // Expose APIs to main world
  try {
    contextBridge.exposeInMainWorld('JC', (window as any).JC);
    contextBridge.exposeInMainWorld('$JC', (window as any).JC);
    safeLog('Preload', 'API exposed to main world');
  } catch (err) {
    safeLog('Preload', `Error exposing API: ${err}`);
  }
  
  safeLog('Preload', 'Preload script completed');
} catch (err) {
  console.error('[JaneczekCord] Critical error in preload script:', err);
}