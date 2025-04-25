"use strict";
// JaneczekCord Module Management System
// Provides a registry for Discord modules and component tracking
Object.defineProperty(exports, "__esModule", { value: true });
exports.findModules = exports.getModuleByDisplayName = exports.getModuleByProps = exports.getModule = exports.moduleRegistry = exports.ModuleRegistry = void 0;
const webpack_1 = require("./webpack");
// Module registry for easy access to important modules
class ModuleRegistry {
    constructor() {
        this.modules = {};
        this.components = {};
        this.subscriptions = new Map();
        this.initialize();
    }
    // Initialize the registry and set up listeners
    initialize() {
        // Listen for webpack ready event
        webpack_1.webpackInterceptor.on('ready', () => {
            console.log('[JC:Modules] Webpack is ready, searching for common modules...');
            this.findCommonModules();
        });
        // Listen for module loaded events
        webpack_1.webpackInterceptor.on('moduleLoaded', (exports, id) => {
            this.processExports(exports, id);
        });
        // Initialize empty DiscordComponents object
        if (!window.DiscordComponents) {
            window.DiscordComponents = {};
        }
    }
    // Get a module by name
    get(name) {
        return this.modules[name];
    }
    // Get a component by display name
    getComponent(name) {
        return this.components[name];
    }
    // Register a module
    register(name, module) {
        this.modules[name] = module;
        // Notify subscribers
        if (this.subscriptions.has(name)) {
            for (const callback of this.subscriptions.get(name)) {
                try {
                    callback(module);
                }
                catch (err) {
                    console.error(`[JC:Modules] Error in ${name} subscription callback:`, err);
                }
            }
        }
        console.log(`[JC:Modules] Registered module: ${name}`);
    }
    // Register a component
    registerComponent(name, component) {
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
    subscribe(name, callback) {
        // If the module is already available, call the callback immediately
        if (this.modules[name]) {
            callback(this.modules[name]);
        }
        // Add to subscription list
        if (!this.subscriptions.has(name)) {
            this.subscriptions.set(name, new Set());
        }
        this.subscriptions.get(name).add(callback);
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
    processExports(exports, id) {
        if (!exports)
            return;
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
    findCommonModules() {
        // Find React
        webpack_1.webpackInterceptor.waitFor(['createElement', 'useState', 'useEffect'], (react) => {
            this.register('React', react);
            window.React = react;
        });
        // Find ReactDOM
        webpack_1.webpackInterceptor.waitFor(['render', 'createPortal'], (reactDOM) => {
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
        webpack_1.webpackInterceptor.waitFor((m) => m && typeof m.dispatch === 'function' && typeof m.subscribe === 'function', (dispatcher) => {
            this.register('Dispatcher', dispatcher);
        });
    }
    // Helper to find and register a module
    findModule(name, props) {
        webpack_1.webpackInterceptor.waitFor(webpack_1.filters.byProps(...props), (module) => {
            this.register(name, module);
        });
    }
}
exports.ModuleRegistry = ModuleRegistry;
// Create and export the singleton instance
exports.moduleRegistry = new ModuleRegistry();
// Export common module getters
const getModule = (filter) => webpack_1.webpackInterceptor.find(filter, { silent: true });
exports.getModule = getModule;
const getModuleByProps = (...props) => webpack_1.webpackInterceptor.find(webpack_1.filters.byProps(...props));
exports.getModuleByProps = getModuleByProps;
const getModuleByDisplayName = (name) => webpack_1.webpackInterceptor.find(webpack_1.filters.byDisplayName(name));
exports.getModuleByDisplayName = getModuleByDisplayName;
const findModules = (filter) => webpack_1.webpackInterceptor.findAll(filter);
exports.findModules = findModules;
//# sourceMappingURL=modules.js.map