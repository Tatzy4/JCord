// preload.ts - JaneczekCord client enhancement

import { contextBridge, session, webFrame } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Type definitions
declare global {
  interface Window {
    JC: {
      React: any;
      ReactDOM: any;
      webpackRequire?: any;
      webpackModules?: Record<string, any>;
      getModule?: (filter: (mod: any) => boolean) => any;
      getModuleByDisplayName?: (displayName: string) => any;
      getModuleByProps?: (...props: string[]) => any;
      findModules?: (filter: (mod: any) => boolean) => any[];
      checkReact?: () => any;
      DevTools?: {
        findComponents: (filter?: string) => Record<string, any>;
        inspectComponent: (element: any) => any[] | null;
        getComponentByName: (name: string) => any;
      };
      LazyComponent?: <T extends object = any>(factory: () => any, attempts?: number) => any;
      waitFor?: (filter: string[] | ((mod: any) => boolean), callback: (mod: any, id: string) => void) => void;
    };
    DiscordComponents: Record<string, any>;
    webpackChunkdiscord_app: any[];
    React: any;
    ReactDOM: any;
    $JC: any;
    $r: (element: any) => any[] | null;
    $components: (filter?: string) => Record<string, any>;
  }
}

// Constants
const IS_DEV = process.env.NODE_ENV === 'development';
const REACT_DEVTOOLS_ID = 'fmkadmapgofadopljbjfkapdkoienihi';
const JC_DATA_DIR = path.join(
  process.env.APPDATA || (process.platform === 'darwin'
    ? path.join(process.env.HOME || '', 'Library', 'Application Support')
    : path.join(process.env.HOME || '', '.config')),
  'JaneczekCord'
);
const EXTENSION_CACHE_DIR = path.join(JC_DATA_DIR, 'ExtensionCache');

// Enhanced logging function
function log(module: string, message: string, ...data: any[]): void {
  console.log(
    `%c JC %c ${module} %c ${message}`, 
    'background: #5865F2; color: white; border-radius: 3px; padding: 1px 3px; font-weight: bold',
    'background: #3ba55c; color: white; border-radius: 3px; padding: 1px 3px; font-weight: bold',
    '',
    ...data
  );
}

// Show banner in console
function showBanner(): void {
  console.log(
    '%c JaneczekCord %c v1.0.0 ',
    'color: white; background: #5865F2; font-weight: bold; padding: 2px 4px; border-radius: 3px;',
    'color: white; background: #3ba55c; font-weight: bold; padding: 2px 4px; border-radius: 3px;'
  );
}

// Initialize JC object
window.JC = {
  React: null,
  ReactDOM: null,
  webpackRequire: null,
  webpackModules: {},
  getModule: null,
  getModuleByDisplayName: null,
  getModuleByProps: null,
  findModules: null,
  checkReact: () => {
    const status = {
      isReactCaptured: !!window.JC.React,
      isReactDOMCaptured: !!window.JC.ReactDOM,
      reactVersion: window.JC.React?.version || 'Not captured',
      reactMethods: window.JC.React ? Object.keys(window.JC.React).filter(m => typeof window.JC.React[m] === 'function').length : 0,
      reactProperties: window.JC.React ? Object.keys(window.JC.React).length : 0,
      reactDOMMethods: window.JC.ReactDOM ? Object.keys(window.JC.ReactDOM).filter(m => typeof window.JC.ReactDOM[m] === 'function').length : 0,
      webpackLoaded: !!window.JC.webpackRequire,
      discordComponents: Object.keys(window.DiscordComponents || {}).length,
      time: new Date().toISOString()
    };
    
    console.table(status);
    return status;
  },
  DevTools: {
    findComponents: (filter = '') => {
      const components: Record<string, any> = {};
      if (window.DiscordComponents) {
        for (const name in window.DiscordComponents) {
          if (filter === '' || name.toLowerCase().includes(filter.toLowerCase())) {
            components[name] = window.DiscordComponents[name];
          }
        }
      }
      return components;
    },
    inspectComponent: (element) => {
      if (!window.JC.React) return null;
      
      try {
        let fiber = null;
        for (const key in element) {
          if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
            fiber = element[key];
            break;
          }
        }
        
        if (!fiber) return null;
        
        let current = fiber;
        const components = [];
        
        while (current) {
          if (current.stateNode && current.stateNode.constructor && 
              current.stateNode.constructor.name !== 'HTMLDivElement') {
            components.push({
              name: current.type?.displayName || current.type?.name || 'Unknown',
              instance: current.stateNode,
              fiber: current
            });
          }
          current = current.return;
        }
        
        return components;
      } catch (e) {
        return null;
      }
    },
    getComponentByName: (name) => {
      return window.DiscordComponents?.[name] || null;
    }
  },
  LazyComponent: null // Will be defined later
};

// Create global placeholder for DiscordComponents
window.DiscordComponents = {};

// Install React DevTools (implementation unchanged)
async function installReactDevTools(): Promise<void> {
  // [unchanged - keeping your original implementation]
}

// Improved implementation of lazy component loading (inspired by Vencord)
function setupLazyComponent(): void {
  // makeLazy function for memoizing expensive operations
  function makeLazy<T>(factory: () => T, attempts = 5): () => T {
    let tries = 0;
    let cache: T;
    return () => {
      if (cache === undefined && attempts > tries++) {
        cache = factory();
        if (cache === undefined && attempts === tries)
          console.error("[JC] Lazy factory failed:", factory);
      }
      return cache;
    };
  }
  
  // LazyComponent for React components
  window.JC.LazyComponent = function<T extends object = any>(factory: () => any, attempts = 5) {
    const get = makeLazy(factory, attempts);
    
    // NoopComponent as fallback
    const NoopComponent = () => null;
    
    const LazyComponent = (props: any) => {
      const Component = get() ?? NoopComponent;
      return window.JC.React.createElement(Component, props);
    };
    
    return LazyComponent;
  };
}

// Vencord-inspired webpack interception for more reliable React capture
function setupWebpackInterception(): void {
  log('Webpack', 'Setting up advanced webpack interception...');
  
  let JCwebpackRequire: any = null;
  let JCcache: any = null;
  let JCresolveReady: () => void;
  const JCready = new Promise<void>(resolve => JCresolveReady = resolve);
  
  // Module and factory listeners
  const moduleListeners = new Set<(exports: any, id: string) => void>();
  const factoryListeners = new Set<(factory: Function, id: string) => void>();
  const waitForSubscriptions = new Map<(mod: any) => boolean, (mod: any, id: string) => void>();
  
  // Symbol constants for internal properties
  const SYM_ORIGINAL_FACTORY = Symbol("JC.originalFactory");
  const SYM_IS_PROXIED_FACTORY = Symbol("JC.isProxiedFactory");
  
  // Helper function for property definition
  const define = (target: any, prop: PropertyKey, attributes: PropertyDescriptor) => {
    if (Object.hasOwnProperty.call(attributes, "value")) {
      attributes.writable = true;
    }
    
    return Reflect.defineProperty(target, prop, {
      configurable: true,
      enumerable: true,
      ...attributes
    });
  };
  
  // Should ignore certain values when processing modules
  function shouldIgnoreValue(value: any): boolean {
    if (value == null) return true;
    if (value === window) return true;
    if (value === document || value === document.documentElement) return true;
    if (value[Symbol.toStringTag] === "DOMTokenList" || value[Symbol.toStringTag] === "IntlMessagesProxy") return true;
    
    // Check for proxies that return non-null values for any property
    const CHECK_KEY = "jc_is_this_a_proxy_that_returns_values_for_any_key";
    if (value[CHECK_KEY] !== undefined) {
      // Try to delete if it was added to a proxy cache
      Reflect.deleteProperty(value, CHECK_KEY);
      return true;
    }
    
    // Check for typed arrays
    if (value instanceof Uint8Array || 
        value instanceof Uint16Array || 
        value instanceof Uint32Array || 
        value instanceof Int8Array || 
        value instanceof Int16Array || 
        value instanceof Int32Array || 
        value instanceof Float32Array || 
        value instanceof Float64Array) {
      return true;
    }
    
    return false;
  }
  
  // Mark properties as non-enumerable for webpack search blacklisting
  function makePropertyNonEnumerable(target: Record<PropertyKey, any>, key: PropertyKey) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor == null) return;
    
    Reflect.defineProperty(target, key, {
      ...descriptor,
      enumerable: false
    });
  }
  
  // Process modules to blacklist bad modules from searches
  function blacklistBadModules(requireCache: any, exports: any, moduleId: PropertyKey): boolean {
    if (shouldIgnoreValue(exports)) {
      makePropertyNonEnumerable(requireCache, moduleId);
      return true;
    }
    
    if (typeof exports !== "object") {
      return false;
    }
    
    let hasOnlyBadProperties = true;
    for (const exportKey in exports) {
      if (shouldIgnoreValue(exports[exportKey])) {
        makePropertyNonEnumerable(exports, exportKey);
      } else {
        hasOnlyBadProperties = false;
      }
    }
    
    return hasOnlyBadProperties;
  }
  
  // Find React in module exports
  function findReactInExports(exports: any): void {
    // Check for React
    if (exports && typeof exports === 'object' && 
        exports.useState && 
        exports.useEffect && 
        exports.createElement && 
        exports.version) {
      if (!window.JC.React) {
        window.JC.React = window.React = exports;
        log('React', `React captured successfully! Version: ${exports.version}`);
      }
    }
    
    // Check for ReactDOM
    if (exports && typeof exports === 'object' && 
        exports.render && 
        exports.createPortal && 
        exports.findDOMNode) {
      if (!window.JC.ReactDOM) {
        window.JC.ReactDOM = window.ReactDOM = exports;
        log('React', 'ReactDOM captured successfully!');
        
        // Initialize React-related utilities
        setupLazyComponent();
        
        // Install React DevTools
        installReactDevTools();
      }
    }
    
    // Register components with displayName for DevTools
    if (typeof exports === 'object' || typeof exports === 'function') {
      try {
        // Direct component with displayName
        if (exports.displayName && typeof exports === 'function') {
          window.DiscordComponents[exports.displayName] = exports;
        }
        
        // Default export with displayName
        if (exports.default?.displayName && typeof exports.default === 'function') {
          window.DiscordComponents[exports.default.displayName] = exports.default;
        }
        
        // Check nested exports for components
        for (const key in exports) {
          const value = exports[key];
          if (value?.displayName && typeof value === 'function') {
            window.DiscordComponents[value.displayName] = value;
          }
        }
      } catch (e) {
        // Ignore errors in component processing
      }
    }
  }
  
  // Process a module's exports
  function processModuleExports(exports: any, moduleId: PropertyKey): void {
    // Skip null exports or blacklisted modules
    if (exports == null || shouldIgnoreValue(exports)) return;
    
    // First look for React and ReactDOM
    findReactInExports(exports);
    
    // Check waiting subscriptions
    for (const [filter, callback] of waitForSubscriptions.entries()) {
      try {
        if (filter(exports)) {
          waitForSubscriptions.delete(filter);
          callback(exports, String(moduleId));
          continue;
        }
        
        if (typeof exports !== 'object') continue;
        
        for (const key in exports) {
          const exportValue = exports[key];
          if (exportValue != null && filter(exportValue)) {
            waitForSubscriptions.delete(filter);
            callback(exportValue, String(moduleId));
            break;
          }
        }
      } catch (err) {
        log('Webpack', `Error in filter callback: ${err}`);
      }
    }
    
    // Notify module listeners
    for (const callback of moduleListeners) {
      try {
        callback(exports, String(moduleId));
      } catch (err) {
        log('Webpack', `Error in module listener: ${err}`);
      }
    }
  }
  
  // Run a factory function with our wrapper
  function runFactoryWithWrapper(factory: any, thisArg: any, argArray: any[]): any {
    const originalFactory = factory[SYM_ORIGINAL_FACTORY] ?? factory;
    const [module, exports, require] = argArray;
    
    // Try to figure out if we need to initialize JCwebpackRequire
    if (!JCwebpackRequire && typeof require === 'function' && require.m != null && require.c != null) {
      JCwebpackRequire = require;
      JCcache = require.c;
      
      window.JC.webpackRequire = JCwebpackRequire;
      setupModuleFinders();
      
      const { stack } = new Error();
      const webpackInstanceFile = stack?.match(/\/assets\/(.+?\.js)/)?.[1];
      log('Webpack', `WebpackRequire initialized from module id ${String(module.id)}${webpackInstanceFile ? ` in ${webpackInstanceFile}` : ''}`);
    }
    
    // Run the original factory
    let factoryReturn;
    try {
      factoryReturn = originalFactory.apply(thisArg, argArray);
    } catch (err) {
      log('Webpack', `Error in module factory: ${err}`);
      return exports;
    }
    
    // Process the exports
    if (module.exports != null) {
      // Skip blacklisted modules
      if (JCcache && blacklistBadModules(JCcache, module.exports, module.id)) {
        return factoryReturn;
      }
      
      processModuleExports(module.exports, module.id);
    }
    
    return factoryReturn;
  }
  
  // Patch a module factory
  function patchFactory(moduleId: PropertyKey, originalFactory: Function): Function {
    // If already patched, return as is
    if (originalFactory[SYM_ORIGINAL_FACTORY] != null) {
      return originalFactory;
    }
    
    // Create a patched factory function
    const patchedFactory: any = function(this: any, ...args: any[]) {
      return runFactoryWithWrapper(patchedFactory, this, args);
    };
    
    // Store original factory
    patchedFactory[SYM_ORIGINAL_FACTORY] = originalFactory;
    
    return patchedFactory;
  }
  
  // Create a proxy for module factories
  function createFactoryProxy(moduleId: PropertyKey, factory: Function): Function {
    // If factory is already proxied, return it
    if (factory[SYM_IS_PROXIED_FACTORY]) {
      return factory;
    }
    
    // Notify factory listeners about the original factory
    for (const listener of factoryListeners) {
      try {
        listener(factory, String(moduleId));
      } catch (err) {
        log('Webpack', `Error in factory listener: ${err}`);
      }
    }
    
    // Create a proxy for the factory
    const proxy = new Proxy(factory, {
      apply(target, thisArg, argArray) {
        // If settings.eagerPatches equivalent was true, we'd patch here directly
        // But instead we patch lazily when the factory is called
        const patchedFactory = patchFactory(moduleId, target);
        return Reflect.apply(patchedFactory, thisArg, argArray);
      },
      
      get(target, prop, receiver) {
        // Special symbols for our internal use
        if (prop === SYM_IS_PROXIED_FACTORY) {
          return true;
        }
        
        if (prop === SYM_ORIGINAL_FACTORY) {
          return target;
        }
        
        // For toString and other special methods, use the original
        if (prop === 'toString') {
          const original = Reflect.get(target, prop, target);
          return original.bind(target);
        }
        
        return Reflect.get(target, prop, receiver);
      }
    });
    
    return proxy;
  }
  
  // Update or proxy a factory
  function updateExistingOrProxyFactory(moduleFactories: any, moduleId: PropertyKey, factory: Function, receiver: any): boolean {
    // Check if this factory already exists somewhere else
    let existingFactory;
    for (const wreq of [JCwebpackRequire].filter(Boolean)) {
      if (wreq.m === moduleFactories) continue;
      
      if (Object.prototype.hasOwnProperty.call(wreq.m, moduleId)) {
        existingFactory = wreq.m[moduleId];
        break;
      }
    }
    
    if (existingFactory) {
      // If factory exists elsewhere and is proxied, use it
      if (existingFactory[SYM_IS_PROXIED_FACTORY]) {
        return Reflect.set(moduleFactories, moduleId, existingFactory, receiver);
      }
    }
    
    // Notify factory listeners
    for (const listener of factoryListeners) {
      try {
        listener(factory, String(moduleId));
      } catch (err) {
        log('Webpack', `Error in factory listener: ${err}`);
      }
    }
    
    // Create a proxy for this factory
    const proxiedFactory = createFactoryProxy(moduleId, factory);
    return Reflect.set(moduleFactories, moduleId, proxiedFactory, receiver);
  }
  
  // Module factories proxy handler
  const moduleFactoriesHandler: ProxyHandler<any> = {
    set(target, moduleId, factory, receiver) {
      return updateExistingOrProxyFactory(target, moduleId, factory, receiver);
    }
  };
  
  // Function.prototype.m hook for webpack interception
  define(Function.prototype, "m", {
    enumerable: false,
    
    set(this: any, originalModules: any) {
      define(this, "m", { value: originalModules });
      
      // Check if this is likely a webpack function
      const { stack } = new Error();
      if (!stack?.includes("http") || stack.match(/at \d+? \(/) || !String(this).includes("exports")) {
        return;
      }

      const fileName = stack.match(/\/assets\/(.+?\.js)/)?.[1];
      log('Webpack', `Detected webpack instance${fileName ? ` in ${fileName}` : ''}`);
      
      // Add Symbol.toStringTag to modules
      define(originalModules, Symbol.toStringTag, {
        value: "JCModuleFactories",
        enumerable: false
      });
      
      // Process and proxy existing modules
      for (const moduleId in originalModules) {
        const factory = originalModules[moduleId];
        originalModules[moduleId] = createFactoryProxy(moduleId, factory);
      }
      
      // Create a proxy for the modules object
      const proxiedModules = new Proxy(originalModules, moduleFactoriesHandler);
      define(this, "m", { value: proxiedModules });
      
      // Detect the main webpack instance via bundlePath ("/assets/")
      define(this, "p", {
        enumerable: false,
        
        set(this: any, bundlePath: string) {
          define(this, "p", { value: bundlePath });
          
          if (bundlePath === "/assets/" && this.c != null) {
            log('Webpack', `Main webpack instance detected with bundlePath: ${bundlePath}`);
            
            // Initialize our webpack require reference
            JCwebpackRequire = this;
            JCcache = this.c;
            
            window.JC.webpackRequire = JCwebpackRequire;
            
            // Setup module finder functions
            setupModuleFinders();
            
            // Indicate webpack is ready
            JCresolveReady();
          }
        }
      });
      
      // Additional detection via O.j property
      define(this, "O", {
        enumerable: false,
        
        set(this: any, onChunksLoaded: any) {
          define(this, "O", { value: onChunksLoaded });
          
          const wreqInstance = this;
          
          define(onChunksLoaded, "j", {
            enumerable: false,
            
            set(this: any, j: any) {
              define(this, "j", { value: j });
              
              if (wreqInstance.p == null) {
                log('Webpack', 'Secondary webpack instance detected via O.j property');
                
                if (!JCwebpackRequire) {
                  JCwebpackRequire = wreqInstance;
                  JCcache = wreqInstance.c;
                  
                  window.JC.webpackRequire = JCwebpackRequire;
                  
                  // Setup module finder functions
                  setupModuleFinders();
                  
                  // Indicate webpack is ready
                  JCresolveReady();
                }
              }
            }
          });
        }
      });
    }
  });
  
  // Setup waitFor utility like Vencord
  window.JC.waitFor = function(filter: string[] | ((mod: any) => boolean), callback: (mod: any, id: string) => void): void {
    let filterFn: (mod: any) => boolean;
    
    if (Array.isArray(filter)) {
      filterFn = (m: any) => m && filter.every(prop => typeof m[prop] !== 'undefined');
    } else {
      filterFn = filter;
    }
    
    // Check existing modules
    if (JCcache) {
      for (const id in JCcache) {
        const mod = JCcache[id];
        if (!mod?.loaded || !mod.exports) continue;
        
        if (filterFn(mod.exports)) {
          callback(mod.exports, id);
          return;
        }
        
        if (typeof mod.exports === 'object') {
          for (const key in mod.exports) {
            const nested = mod.exports[key];
            if (nested && filterFn(nested)) {
              callback(nested, id);
              return;
            }
          }
        }
      }
    }
    
    // Add to waiting subscriptions if not found
    waitForSubscriptions.set(filterFn, callback);
  };
  
  // Setup find with Vencord-style API
  function find(filter: (mod: any) => boolean, options: any = {}): any {
    if (typeof filter !== "function") {
      throw new Error("Invalid filter. Expected a function");
    }
    
    if (!JCcache) return null;
    
    for (const key in JCcache) {
      const mod = JCcache[key];
      if (!mod?.loaded || mod.exports == null) continue;
      
      if (filter(mod.exports)) {
        return mod.exports;
      }
      
      if (typeof mod.exports !== "object") continue;
      
      for (const nestedKey in mod.exports) {
        const nested = mod.exports[nestedKey];
        if (nested && filter(nested)) {
          return nested;
        }
      }
    }
    
    if (!options.silent) {
      log('Webpack', `Module not found using filter: ${filter}`);
    }
    
    return null;
  }
  
  // Setup findAll method
  function findAll(filter: (mod: any) => boolean): any[] {
    if (typeof filter !== "function") {
      throw new Error("Invalid filter. Expected a function");
    }
    
    const results = [] as any[];
    if (!JCcache) return results;
    
    for (const key in JCcache) {
      const mod = JCcache[key];
      if (!mod?.loaded || mod.exports == null) continue;
      
      if (filter(mod.exports)) {
        results.push(mod.exports);
      }
      
      if (typeof mod.exports !== "object") continue;
      
      for (const nestedKey in mod.exports) {
        const nested = mod.exports[nestedKey];
        if (nested && filter(nested)) {
          results.push(nested);
        }
      }
    }
    
    return results;
  }
  
  // Setup filter helpers like Vencord
  const filters = {
    byProps: (...props: string[]): ((mod: any) => boolean) => {
      return props.length === 1
        ? (m: any) => m && m[props[0]] !== undefined
        : (m: any) => m && props.every(p => m[p] !== undefined);
    },
    
    byCode: (...code: Array<string | RegExp>): ((mod: any) => boolean) => {
      return (m: any) => {
        if (typeof m !== "function") return false;
        const fnStr = Function.prototype.toString.call(m);
        return code.every(c => 
          typeof c === "string" 
            ? fnStr.includes(c) 
            : (c.global && (c.lastIndex = 0), c.test(fnStr))
        );
      };
    },
    
    byDisplayName: (name: string): ((mod: any) => boolean) => {
      return (m: any) => {
        if (!m) return false;
        if (m.displayName === name) return true;
        if (m.default && m.default.displayName === name) return true;
        return false;
      };
    },
    
    componentByCode: (...code: Array<string | RegExp>): ((mod: any) => boolean) => {
      const byCodeFilter = filters.byCode(...code);
      return (m: any) => {
        if (!m) return false;
        
        // Check component itself
        if (byCodeFilter(m)) return true;
        
        // Check if it's a React component
        if (!m.$$typeof) return false;
        
        // Check memos
        if (m.type && byCodeFilter(m.type)) return true;
        
        // Check render method (forwardRefs, class components)
        if (m.render && byCodeFilter(m.render)) return true;
        
        return false;
      };
    }
  };
  
  // Setup module finder functions
  function setupModuleFinders() {
    window.JC.getModule = (filter) => find(filter, { silent: true });
    
    window.JC.findModules = (filter) => findAll(filter);
    
    window.JC.getModuleByProps = (...props) => {
      return find(filters.byProps(...props), { silent: true });
    };
    
    window.JC.getModuleByDisplayName = (displayName) => {
      return find(filters.byDisplayName(displayName), { silent: true });
    };
  }
  
  // Actively search for React and ReactDOM when webpack is ready
  JCready.then(() => {
    if (!window.JC.React || !window.JC.ReactDOM) {
      log('React', 'Searching for React and ReactDOM...');
      
      // Find React
      window.JC.waitFor(['createElement', 'useState', 'useEffect'], (react) => {
        window.JC.React = window.React = react;
        log('React', `React found! Version: ${react.version}`);
      });
      
      // Find ReactDOM
      window.JC.waitFor(['render', 'createPortal'], (reactDOM) => {
        window.JC.ReactDOM = window.ReactDOM = reactDOM;
        log('React', 'ReactDOM found!');
        
        // Initialize React-related utilities
        setupLazyComponent();
        
        // Install React DevTools
        installReactDevTools();
      });
    }
  });
}


// Block Sentry and analytics
function blockSentry(): void {
  // [unchanged - keeping your original implementation]
}

// Replace Discord logo with JaneczekCord logo
function replaceDiscordLogo(): void {
  // [unchanged - keeping your original implementation]
}

// Expose JaneczekCord API to the main world
function exposeAPI(): void {
  try {
    contextBridge.exposeInMainWorld('JC', window.JC);
    contextBridge.exposeInMainWorld('$JC', window.JC);
    contextBridge.exposeInMainWorld('$r', (element: any) => window.JC.DevTools?.inspectComponent(element));
    contextBridge.exposeInMainWorld('$components', (filter?: string) => window.JC.DevTools?.findComponents(filter));
    
    log('API', 'JaneczekCord API exposed to main world');
  } catch (error) {
    log('API', 'Failed to expose API: ' + error);
    console.error(error);
  }
}

// Main initialization function
function initJaneczekCord(): void {
  // [unchanged - keeping your original implementation]
}

// If Discord loads our preload script directly via DOM, we need to inject it
function setupDiscordStyle(): void {
  // [unchanged - keeping your original implementation]
}

// Start JaneczekCord
try {
  // 1. Initialize CSS first
  setupDiscordStyle();
  
  // 2. Set up webpack interception (capture React and modules)
  setupWebpackInterception();
  
  // 3. Block Sentry and analytics
  blockSentry();
  
  // 4. Load Discord's original preload if available
  const originalPreload = process.env.DISCORD_ORIGINAL_PRELOAD;
  if (originalPreload) {
    log('Patcher', `Loading Discord original preload: ${originalPreload}`);
    require(originalPreload);
  }
  
  // 5. Expose API
  exposeAPI();
  
  // 6. Initialize UI when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJaneczekCord);
  } else {
    initJaneczekCord();
  }
  
  // 7. Execute any injected JS that may be in the DOM
  if (location.protocol !== "data:") {
    webFrame.executeJavaScript(`
      console.log("[JaneczekCord] Executing webFrame injection");
      // Additional runtime code could go here if needed
    `);
  }
} catch (error) {
  console.error('[JaneczekCord] Critical error in preload script:', error);
}