// JaneczekCord Module Management System
// Provides a registry for Discord modules and component tracking

import { webpackInterceptor, filters } from './webpack';

// Add React and ReactDOM to Window interface
declare global {
  interface Window {
    React: any;
    ReactDOM: any;
    DiscordComponents?: Record<string, any>;
  }
}

// Module registry for easy access to important modules
export class ModuleRegistry {
  private modules: Record<string, any> = {};
  private components: Record<string, any> = {};
  private subscriptions: Map<string, Set<(mod: any) => void>> = new Map();
  
  constructor() {
    this.initialize();
  }
  
  // Initialize the registry and set up listeners
  private initialize(): void {
    // Listen for webpack ready event
    webpackInterceptor.on('ready', () => {
      console.log('[JC:Modules] Webpack is ready, searching for common modules...');
      this.findCommonModules();
    });
    
    // Listen for module loaded events
    webpackInterceptor.on('moduleLoaded', (exports, id) => {
      this.processExports(exports, id);
    });

    // Initialize empty DiscordComponents object
    if (!window.DiscordComponents) {
      window.DiscordComponents = {};
    }
  }
  
  // Get a module by name
  get(name: string): any {
    return this.modules[name];
  }
  
  // Get a component by display name
  getComponent(name: string): any {
    return this.components[name];
  }
  
  // Register a module
  register(name: string, module: any): void {
    this.modules[name] = module;
    
    // Notify subscribers
    if (this.subscriptions.has(name)) {
      for (const callback of this.subscriptions.get(name)!) {
        try {
          callback(module);
        } catch (err) {
          console.error(`[JC:Modules] Error in ${name} subscription callback:`, err);
        }
      }
    }
    
    console.log(`[JC:Modules] Registered module: ${name}`);
  }
  
  // Register a component
  registerComponent(name: string, component: any): void {
    if (!this.components[name]) {
      this.components[name] = component;
      
      // Also add to DiscordComponents for easy access
      if (window.DiscordComponents) {
        window.DiscordComponents[name] = component;
      }
      
      console.log(`[JC:Modules] Registered component: ${name}`);
    }
  }
  
  // Subscribe to a module
  subscribe(name: string, callback: (mod: any) => void): () => void {
    // If the module is already available, call the callback immediately
    if (this.modules[name]) {
      callback(this.modules[name]);
    }
    
    // Add to subscription list
    if (!this.subscriptions.has(name)) {
      this.subscriptions.set(name, new Set());
    }
    
    this.subscriptions.get(name)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(name);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(name);
        }
      }
    };
  }
  
  // Process module exports to find components and important modules
  private processExports(exports: any, id: string): void {
    if (!exports) return;
    
    // Register React components with displayName
    if (typeof exports === 'function' && exports.displayName) {
      this.registerComponent(exports.displayName, exports);
    }
    
    // Check default export for components
    if (exports.default && typeof exports.default === 'function' && exports.default.displayName) {
      this.registerComponent(exports.default.displayName, exports.default);
    }
    
    // Check nested exports for components
    if (typeof exports === 'object') {
      for (const key in exports) {
        const value = exports[key];
        if (value && typeof value === 'function' && value.displayName) {
          this.registerComponent(value.displayName, value);
        }
      }
    }
  }
  
  // Find common Discord modules
  private findCommonModules(): void {
    // Find React
    webpackInterceptor.waitFor(['createElement', 'useState', 'useEffect'], (react) => {
      this.register('React', react);
      window.React = react;
    });
    
    // Find ReactDOM
    webpackInterceptor.waitFor(['render', 'createPortal'], (reactDOM) => {
      this.register('ReactDOM', reactDOM);
      window.ReactDOM = reactDOM;
    });
    
    // Find common Discord modules
    this.findModule('UserStore', ['getCurrentUser', 'getUser', 'getUsers']);
    this.findModule('ChannelStore', ['getChannel', 'getChannels']);
    this.findModule('GuildStore', ['getGuild', 'getGuilds']);
    this.findModule('MessageStore', ['getMessage', 'getMessages']);
    this.findModule('RelationshipStore', ['getFriendIDs', 'getRelationships']);
    this.findModule('SelectedChannelStore', ['getChannelId', 'getLastSelectedChannelId']);
    this.findModule('SelectedGuildStore', ['getGuildId', 'getLastSelectedGuildId']);
    
    // Find the Dispatcher
    webpackInterceptor.waitFor(
      (m) => m && typeof m.dispatch === 'function' && typeof m.subscribe === 'function',
      (dispatcher) => {
        this.register('Dispatcher', dispatcher);
      }
    );
  }
  
  // Helper to find and register a module
  private findModule(name: string, props: string[]): void {
    webpackInterceptor.waitFor(filters.byProps(...props), (module) => {
      this.register(name, module);
    });
  }
}

// Create and export the singleton instance
export const moduleRegistry = new ModuleRegistry();

// Export common module getters
export const getModule = (filter: (mod: any) => boolean) => 
  webpackInterceptor.find(filter, { silent: true });

export const getModuleByProps = (...props: string[]) => 
  webpackInterceptor.find(filters.byProps(...props));

export const getModuleByDisplayName = (name: string) => 
  webpackInterceptor.find(filters.byDisplayName(name));

export const findModules = (filter: (mod: any) => boolean) => 
  webpackInterceptor.findAll(filter);