// JaneczekCord Preload - Runs when Discord window starts
// This file is injected into Discord to add our modifications

// Declare JC property on Window interface
declare global {
  interface Window {
    JC: {
      React: any;
      webpackRequire?: any;
    };
  }
}

import { contextBridge } from 'electron';

// Ensure JaneczekCord runs first by adding priority code
(function enforceJaneczekCordPriority() {
  // This self-executing function runs first and ensures JaneczekCord has highest priority
  
  // 1. Create a mutex to prevent Discord from loading first
  const JANECZEKCORD_RUNNING = Symbol('JANECZEKCORD_RUNNING');
  (window as any)[JANECZEKCORD_RUNNING] = true;
  
  // 2. Store original setTimeout to prevent any race conditions
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(callback, timeout, ...args) {
    // If JaneczekCord is still initializing, delay all other setTimeout calls
    if ((window as any)[JANECZEKCORD_RUNNING] && timeout < 1000) {
      timeout = 1000; // Force other code to wait for JaneczekCord
    }
    return originalSetTimeout.call(this, callback, timeout, ...args);
  } as typeof window.setTimeout;
  
  // 3. When JaneczekCord is done, we'll release the mutex
  window.addEventListener('JaneczekCordReady', () => {
    delete (window as any)[JANECZEKCORD_RUNNING];
    window.setTimeout = originalSetTimeout;
  }, { once: true });
  
  console.log('🚀 JC: Priority enforced');
})();

// Load Discord's original preload
function loadOriginalPreload(): void {
  try {
    const originalPreload = process.env.DISCORD_ORIGINAL_PRELOAD;
    if (originalPreload) {
      log('Patcher', `Loading Discord original preload from: ${originalPreload}`);
      require(originalPreload);
    } else {
      log('Patcher', 'No original preload path found');
    }
  } catch (err) {
    console.error('Error loading Discord preload:', err);
  }
}

// Enhanced logging function in Vencord style
function log(module: string, message: string): void {
  // Colors similar to Vencord style
  const colors = {
    janeczekcord: 'background: #5865F2; color: white; border-radius: 3px; padding: 1px 4px; font-weight: bold',
    module: 'background: #3ba55c; color: white; border-radius: 3px; padding: 1px 4px; font-weight: bold',
    reset: ''
  };
  
  // Log with Vencord-style formatting
  console.log(`%c JaneczekCord %c ${module} %c ${message}`, 
              colors.janeczekcord, colors.module, colors.reset);
}

// Show banner in console - simplified
function showBanner(): void {
  console.log(
    '%cJaneczekCord %cby Janeczek',
    'color: white; background: #5865F2; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
    'color: #5865F2; font-weight: bold;'
  );
}

// Early Sentry blocking using enhanced approach
function blockSentryEarly(): void {
  log('Security', 'Initializing privacy protection');
  
  // Block Sentry script loading by intercepting any script tag
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const element = originalCreateElement.call(document, tagName);
    
    if (tagName.toLowerCase() === 'script') {
      // Override the setter for the src attribute
      const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      if (originalSrcDescriptor && originalSrcDescriptor.set) {
        Object.defineProperty(element, 'src', {
          set(value) {
            if (typeof value === 'string' && 
                (value.includes('sentry') || 
                 value.includes('browser-bundle') || 
                 value.includes('fb9967f3b16e8ac7'))) {
              log('Security', `Blocked Sentry script: ${value.substring(0, 30)}...`);
              
              // Don't actually set the src, but simulate loading
              setTimeout(() => {
                if (typeof this.onload === 'function') {
                  const event = new Event('load');
                  this.onload(event);
                }
              }, 0);
              return;
            }
            originalSrcDescriptor.set.call(this, value);
          },
          get: originalSrcDescriptor.get
        });
      }
    }
    
    return element;
  };
  
  // Method 1: Hook webpack.g to catch Sentry initialization
  Object.defineProperty(Function.prototype, "g", {
    configurable: true,

    set(globalObj: any) {
      Object.defineProperty(this, "g", {
        value: globalObj,
        configurable: true,
        enumerable: true,
        writable: true
      });

      // Ensure this is most likely the Sentry WebpackInstance
      const { stack } = new Error();
      if (this.c != null || !stack?.includes("http") || !String(this).includes("exports:{}")) {
        return;
      }

      const assetPath = stack.match(/http.+?(?=:\d+?:\d+?$)/m)?.[0];
      if (!assetPath) {
        return;
      }

      // Check if this is a Sentry script
      if (assetPath.includes('sentry') || 
          assetPath.includes('browser-bundle') || 
          assetPath.includes('fb9967f3b16e8ac7')) {
        log('Security', 'Prevented Sentry WebpackInstance initialization');
        Reflect.deleteProperty(Function.prototype, "g");
        Reflect.deleteProperty(window, "DiscordSentry");
        throw new Error("Sentry blocked");
      }
    }
  });

  // Method 2: Prevent window.DiscordSentry from being set
  Object.defineProperty(window, "DiscordSentry", {
    configurable: true,
    
    set() {
      log('Security', 'Blocked DiscordSentry global object assignment');
      Reflect.deleteProperty(Function.prototype, "g");
      Reflect.deleteProperty(window, "DiscordSentry");
    },
    
    get() {
      return undefined;
    }
  });
  
  // Method 3: Block network requests for Sentry
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = input instanceof Request ? input.url : String(input);
    
    if (url.includes('sentry') || 
        url.includes('browser-bundle') || 
        url.includes('fb9967f3b16e8ac7') ||
        url.includes('discord.com/api/v9/science') ||
        url.includes('discord.com/api/v9/track')) {
      // Quietly block it without logging to avoid console spam
      return Promise.resolve(new Response('{"status":"ok"}', { status: 200 }));
    }
    
    return originalFetch.apply(this, arguments);
  };
}

// Block Discord's analytics
function blockAnalytics(): void {
  // Wait briefly for Discord's JS to load, then try to block analytics
  setTimeout(() => {
    try {
      const win = window as any;
      
      // Block AnalyticsActionHandlers
      if (win.AnalyticsActionHandlers && win.AnalyticsActionHandlers.handle) {
        win._originalAnalyticsHandle = win.AnalyticsActionHandlers.handle;
        win.AnalyticsActionHandlers.handle = () => {};
      }
      
      // Block metrics
      if (win.METRICS || win._METRICS) {
        const metrics = win.METRICS || win._METRICS;
        if (metrics) {
          ['increment', 'track', 'trackEvent', 'distribution'].forEach(method => {
            if (typeof metrics[method] === 'function') {
              metrics[method] = () => {};
            }
          });
          
          if (metrics._intervalId) {
            clearInterval(metrics._intervalId);
            metrics._intervalId = undefined;
          }
        }
      }
    } catch (error) {
      console.error('❌ JC: Analytics blocking error', error);
    }
  }, 1000);
}

// Detect and expose React early
function captureReact(): void {
  // Create placeholder
  window.JC = { 
    React: null
  };
  
  // Save React detection
  let reactFound = false;
  
  // Function to check if an object is React
  const isReact = (obj: any): boolean => {
    return obj && 
           typeof obj.createElement === 'function' && 
           typeof obj.Component === 'function' && 
           typeof obj.useState === 'function';
  };
  
  // Method 1: Intercept webpack modules
  const originalPush = Array.prototype.push;
  Array.prototype.push = function(...args) {
    // Check if this might be a webpack chunk
    if (this === (window as any).webpackChunkdiscord_app && args[0] && Array.isArray(args[0])) {
      log('WebpackDetector', 'Monitoring Discord webpack chunk');
      
      // Check if this chunk contains a module map
      if (args[0].length > 1 && typeof args[0][1] === 'object') {
        const moduleMap = args[0][1];
        
        // Intercept module factories to detect React
        for (const id in moduleMap) {
          const originalFactory = moduleMap[id];
          
          moduleMap[id] = function(module, exports, require) {
            // Call original factory
            originalFactory.apply(this, arguments);
            
            // Check if this is React
            if (!reactFound && isReact(exports)) {
              log('ReactDetector', 'React captured from webpack!');
              window.JC.React = exports;
              reactFound = true;
            }
            
            // Check for nested exports
            if (!reactFound && exports && typeof exports === 'object') {
              for (const key in exports) {
                if (isReact(exports[key])) {
                  log('ReactDetector', `React found in module export ${key}`);
                  window.JC.React = exports[key];
                  reactFound = true;
                  break;
                }
              }
            }
          };
        }
      }
      
      // Save webpack require
      if (!reactFound && args[0].length > 2 && typeof args[0][2] === 'function') {
        const webpackRequire = args[0][2];
        window.JC.webpackRequire = webpackRequire;
        
        // Scan for React in existing modules
        if (webpackRequire.c) {
          log('WebpackDetector', 'Scanning webpack cache for React');
          
          for (const id in webpackRequire.c) {
            const module = webpackRequire.c[id];
            if (!module?.exports) continue;
            
            if (isReact(module.exports)) {
              log('ReactDetector', 'React found in webpack cache');
              window.JC.React = module.exports;
              reactFound = true;
              break;
            }
            
            // Check exports object
            if (typeof module.exports === 'object') {
              for (const key in module.exports) {
                if (isReact(module.exports[key])) {
                  log('ReactDetector', `React found in cached module ${id}.${key}`);
                  window.JC.React = module.exports[key];
                  reactFound = true;
                  break;
                }
              }
            }
            
            if (reactFound) break;
          }
        }
      }
    }
    
    return originalPush.apply(this, args);
  };
  
  // Method 2: Check DOM for React components
  const checkDOMForReact = () => {
    const reactElements = document.querySelectorAll('[data-reactroot], [reactroot], [react-root]');
    
    if (reactElements.length > 0) {
      log('ReactDetector', `Found ${reactElements.length} React elements in DOM`);
      
      for (const el of reactElements) {
        // Search for React internal properties
        for (const key in el) {
          if (key.startsWith('__reactInternalInstance') || 
              key.startsWith('__reactFiber') || 
              key.startsWith('__reactProps')) {
            
            log('ReactDetector', 'Found React internal property');
            
            // Try to find React through element internals
            const internal = (el as any)[key];
            if (internal && internal._owner && internal._owner.stateNode) {
              const component = internal._owner.stateNode;
              
              // Try to find React through component internals
              const proto = Object.getPrototypeOf(component);
              if (proto && proto.constructor && proto.constructor.name === 'Component') {
                // Likely found React.Component
                const reactLib = Object.getPrototypeOf(proto.constructor);
                
                if (isReact(reactLib)) {
                  log('ReactDetector', 'React found through DOM elements');
                  window.JC.React = reactLib;
                  reactFound = true;
                }
              }
            }
          }
        }
      }
    }
  };
  
  // Check DOM on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkDOMForReact);
  } else {
    checkDOMForReact();
  }
  
  // Method 3: Check global variables
  setTimeout(() => {
    if (!reactFound) {
      log('ReactDetector', 'Searching for React in global scope');
      
      // Check common global React variables
      const possibleNames = ['React', 'react', 'ReactModule', 'ReactDOM'];
      
      for (const name of possibleNames) {
        if ((window as any)[name] && isReact((window as any)[name])) {
          log('ReactDetector', `React found in global.${name}`);
          window.JC.React = (window as any)[name];
          reactFound = true;
          break;
        }
      }
      
      // If nothing found yet, scan all window properties
      if (!reactFound) {
        for (const key in window) {
          try {
            const value = (window as any)[key];
            if (isReact(value)) {
              log('ReactDetector', `React found in window.${key}`);
              window.JC.React = value;
              reactFound = true;
              break;
            }
          } catch (e) {
            // Ignore permission errors
          }
        }
      }
    }
    
    // Show success or failure
    if (reactFound) {
      log('ReactDetector', 'React successfully captured and exposed as window.JC.React');
    } else {
      log('ReactDetector', 'Could not find React - try again after page fully loads');
    }
  }, 2000);
}

// Expose JaneczekCord API
function exposeAPI(): void {
  try {
    contextBridge.exposeInMainWorld('JC', {
      version: '1.0.0',
      enabled: true
    });
  } catch (error) {
    console.error('❌ JC: API exposure error', error);
  }
}

// Initialize JaneczekCord
function initJaneczekCord(): void {
  try {
    // Show banner
    showBanner();
    
    // Replace Discord logo
    setTimeout(() => {
      try {
        const observer = new MutationObserver(() => {
          const wordmark = document.querySelector('[class*="wordmark"]');
          if (wordmark && !wordmark.hasAttribute('janeczekcord-modified')) {
            // Create custom logo text
            const customLogo = document.createElement('div');
            customLogo.style.color = '#5865F2';
            customLogo.style.fontWeight = '800';
            customLogo.style.fontSize = '16px';
            customLogo.style.fontFamily = 'var(--font-display, "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif)';
            customLogo.textContent = 'JaneczekCord';
            
            // Replace the original wordmark
            wordmark.innerHTML = '';
            wordmark.appendChild(customLogo);
            wordmark.setAttribute('janeczekcord-modified', 'true');
            
            log('UI', 'Discord logo replaced with JaneczekCord branding');
          }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (error) {
        console.error('Error replacing Discord logo:', error);
      }
    }, 1000);
    
    // Signal that JaneczekCord is ready
    window.dispatchEvent(new Event('JaneczekCordReady'));
  } catch (error) {
    console.error('Error during JaneczekCord initialization:', error);
  }
}

// Start loading process - JaneczekCord runs FIRST
try {
  log('Core', 'JaneczekCord starting up');
  
  // Setup React capture
  captureReact();
  
  // 1. Install Sentry blocking
  blockSentryEarly();
  
  // 2. Block Discord analytics
  blockAnalytics();
  
  // 3. Only NOW load Discord's original preload
  loadOriginalPreload();
  
  // 4. Expose JaneczekCord API
  exposeAPI();
  
  // 5. Initialize JaneczekCord UI when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJaneczekCord);
  } else {
    initJaneczekCord();
  }
} catch (error) {
  console.error('Error during JaneczekCord initialization:', error);
}