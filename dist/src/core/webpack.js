"use strict";
// JaneczekCord Webpack Interceptor (Fixed for Electron context)
// Intercepts Discord's webpack process to access modules
Object.defineProperty(exports, "__esModule", { value: true });
exports.filters = exports.webpackInterceptor = exports.WebpackInterceptor = void 0;
const events_1 = require("events");
// Symbols for internal properties
const SYM_ORIGINAL_FACTORY = Symbol("JC.originalFactory");
const SYM_IS_PROXIED_FACTORY = Symbol("JC.isProxiedFactory");
// Debug logging - safe version that doesn't rely on console styling
function debugLog(area, message, ...data) {
    console.log(`[JC:Debug][${area}] ${message}`, ...data);
}
// Interceptor class for webpack
class WebpackInterceptor extends events_1.EventEmitter {
    constructor() {
        super();
        this.webpackRequire = null;
        this.moduleCache = null;
        this.ready = false;
        this.moduleWaiters = new Map();
        debugLog('Webpack', 'WebpackInterceptor constructor called');
        // Delay setup to ensure it runs in the proper context
        setTimeout(() => {
            this.setupInterception();
        }, 0);
    }
    // Check if webpack require is available
    isReady() {
        return this.ready && !!this.webpackRequire;
    }
    // Get the webpack require function
    getRequire() {
        return this.webpackRequire;
    }
    // Get the module cache
    getCache() {
        return this.moduleCache;
    }
    // Find a module by filter
    find(filter, options = {}) {
        if (!this.isReady()) {
            if (!options.silent) {
                debugLog('Webpack', 'find() called but webpack is not ready yet');
            }
            return null;
        }
        for (const key in this.moduleCache) {
            const mod = this.moduleCache[key];
            if (!mod?.loaded || mod.exports == null)
                continue;
            if (filter(mod.exports)) {
                return mod.exports;
            }
            if (typeof mod.exports === "object") {
                for (const nestedKey in mod.exports) {
                    const nested = mod.exports[nestedKey];
                    if (nested && filter(nested)) {
                        return nested;
                    }
                }
            }
        }
        if (!options.silent) {
            debugLog('Webpack', 'Module not found using filter');
        }
        return null;
    }
    // Find all modules matching a filter
    findAll(filter) {
        if (!this.isReady()) {
            debugLog('Webpack', 'findAll() called but webpack is not ready yet');
            return [];
        }
        const results = [];
        for (const key in this.moduleCache) {
            const mod = this.moduleCache[key];
            if (!mod?.loaded || mod.exports == null)
                continue;
            if (filter(mod.exports)) {
                results.push(mod.exports);
            }
            if (typeof mod.exports === "object") {
                for (const nestedKey in mod.exports) {
                    const nested = mod.exports[nestedKey];
                    if (nested && filter(nested)) {
                        results.push(nested);
                    }
                }
            }
        }
        return results;
    }
    // Wait for a module to be loaded
    waitFor(filter, callback) {
        let filterFn;
        if (Array.isArray(filter)) {
            filterFn = (m) => m && filter.every(prop => typeof m[prop] !== 'undefined');
        }
        else {
            filterFn = filter;
        }
        // Check existing modules
        if (this.isReady()) {
            debugLog('Webpack', `Checking existing modules for waitFor condition`);
            for (const id in this.moduleCache) {
                const mod = this.moduleCache[id];
                if (!mod?.loaded || !mod.exports)
                    continue;
                if (filterFn(mod.exports)) {
                    debugLog('Webpack', `Found matching module in cache with ID ${id}`);
                    callback(mod.exports, id);
                    return;
                }
                if (typeof mod.exports === 'object') {
                    for (const key in mod.exports) {
                        const nested = mod.exports[key];
                        if (nested && filterFn(nested)) {
                            debugLog('Webpack', `Found matching nested module in cache at ${id}.${key}`);
                            callback(nested, id);
                            return;
                        }
                    }
                }
            }
            debugLog('Webpack', 'Module not found in existing cache, adding to waiters');
        }
        else {
            debugLog('Webpack', 'Webpack not ready, adding to waiters for future detection');
        }
        // Add to waiting subscribers if not found
        this.moduleWaiters.set(filterFn, callback);
    }
    // Process a module's exports
    processModule(exports, moduleId) {
        if (!exports)
            return;
        // Check for React specifically
        if (exports && typeof exports === 'object' &&
            exports.useState && exports.useEffect &&
            exports.createElement && exports.version) {
            debugLog('Webpack', `**FOUND REACT**: version ${exports.version}`);
        }
        // Check for ReactDOM
        if (exports && typeof exports === 'object' &&
            exports.render && exports.createPortal &&
            exports.findDOMNode) {
            debugLog('Webpack', '**FOUND REACTDOM**');
        }
        // Check if any waiters are looking for this module
        for (const [filter, callback] of this.moduleWaiters.entries()) {
            try {
                if (filter(exports)) {
                    this.moduleWaiters.delete(filter);
                    callback(exports, moduleId);
                    continue;
                }
                if (typeof exports === 'object') {
                    for (const key in exports) {
                        const exportValue = exports[key];
                        if (exportValue && filter(exportValue)) {
                            this.moduleWaiters.delete(filter);
                            callback(exportValue, moduleId);
                            break;
                        }
                    }
                }
            }
            catch (err) {
                console.error('[JC:Webpack] Error in filter callback:', err);
            }
        }
        // Emit module loaded event
        this.emit('moduleLoaded', exports, moduleId);
    }
    // Setup the webpack interception
    setupInterception() {
        debugLog('Webpack', 'Setting up webpack interception');
        // Create proxy for factory functions
        const createFactoryProxy = (moduleId, factory) => {
            // Skip if already proxied
            if (factory[SYM_IS_PROXIED_FACTORY]) {
                return factory;
            }
            // Create a proxy to intercept module creation
            const proxy = new Proxy(factory, {
                apply: (target, thisArg, argArray) => {
                    const [module, exports, require] = argArray;
                    // Get original factory or use the target
                    const originalFactory = target[SYM_ORIGINAL_FACTORY] || target;
                    // Try to detect webpack require
                    if (!this.webpackRequire && typeof require === 'function' &&
                        require.m && require.c) {
                        this.webpackRequire = require;
                        this.moduleCache = require.c;
                        this.ready = true;
                        debugLog('Webpack', 'Webpack require captured via factory proxy!');
                        this.emit('ready', require);
                    }
                    // Call the original factory
                    const result = originalFactory.apply(thisArg, argArray);
                    // Process the module after it's loaded
                    if (module.exports) {
                        this.processModule(module.exports, module.id);
                    }
                    return result;
                },
                get: (target, prop, receiver) => {
                    if (prop === SYM_IS_PROXIED_FACTORY) {
                        return true;
                    }
                    if (prop === SYM_ORIGINAL_FACTORY) {
                        return target;
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });
            return proxy;
        };
        // Module factories proxy handler
        const moduleFactoriesHandler = {
            set: (target, moduleId, factory, receiver) => {
                // Only proxy functions
                if (typeof factory === 'function') {
                    const proxiedFactory = createFactoryProxy(String(moduleId), factory);
                    return Reflect.set(target, moduleId, proxiedFactory, receiver);
                }
                return Reflect.set(target, moduleId, factory, receiver);
            }
        };
        // Hook into Function.prototype.m for webpack detection
        try {
            Object.defineProperty(Function.prototype, 'm', {
                configurable: true,
                set(originalModules) {
                    // Store the original value
                    Object.defineProperty(this, 'm', { value: originalModules, writable: true });
                    // Check if this looks like webpack
                    const { stack } = new Error();
                    if (!stack?.includes('http') || !String(this).includes('exports')) {
                        return;
                    }
                    debugLog('Webpack', 'Detected webpack modules via Function.prototype.m hook');
                    // Process existing modules
                    for (const moduleId in originalModules) {
                        const factory = originalModules[moduleId];
                        if (typeof factory === 'function') {
                            originalModules[moduleId] = createFactoryProxy(moduleId, factory);
                        }
                    }
                    // Create a proxy for future modules
                    const proxiedModules = new Proxy(originalModules, moduleFactoriesHandler);
                    Object.defineProperty(this, 'm', { value: proxiedModules });
                },
                get() {
                    return undefined;
                }
            });
        }
        catch (e) {
            debugLog('Webpack', 'Error setting up Function.prototype.m hook:', e);
        }
        // Alternative: Try to find webpack modules by checking window.__REACT_DEVTOOLS_GLOBAL_HOOK__
        setTimeout(() => {
            if (!this.isReady() && typeof window !== 'undefined') {
                try {
                    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                        debugLog('Webpack', 'Trying to find React via DevTools hook');
                        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                        if (hook.renderers && hook.renderers.size > 0) {
                            const renderer = hook.renderers.get(Array.from(hook.renderers.keys())[0]);
                            if (renderer && renderer.React) {
                                debugLog('Webpack', `Found React via DevTools hook: v${renderer.React.version}`);
                                this.processModule(renderer.React, 'reactDevTools');
                            }
                        }
                    }
                    // Check for Discord's webpack chunks
                    if (window.webpackChunkdiscord_app) {
                        debugLog('Webpack', 'Found webpackChunkdiscord_app, setting up interception');
                        const webpackChunk = window.webpackChunkdiscord_app;
                        const originalPush = webpackChunk.push;
                        webpackChunk.push = (...args) => {
                            const result = originalPush.apply(webpackChunk, args);
                            try {
                                const [chunk] = args;
                                if (chunk && chunk.length > 1) {
                                    const [, runtime] = chunk;
                                    if (runtime && typeof runtime === 'object') {
                                        for (const key in runtime) {
                                            const obj = runtime[key];
                                            if (typeof obj === 'function' && obj.m && obj.c) {
                                                if (!this.webpackRequire) {
                                                    debugLog('Webpack', 'Found webpack require via chunk push');
                                                    this.webpackRequire = obj;
                                                    this.moduleCache = obj.c;
                                                    this.ready = true;
                                                    this.emit('ready', obj);
                                                    // Process already loaded modules
                                                    for (const moduleId in this.moduleCache) {
                                                        const mod = this.moduleCache[moduleId];
                                                        if (mod?.loaded && mod.exports) {
                                                            this.processModule(mod.exports, moduleId);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                debugLog('Webpack', 'Error processing chunk:', e);
                            }
                            return result;
                        };
                    }
                }
                catch (e) {
                    debugLog('Webpack', 'Error in alternative webpack detection:', e);
                }
            }
        }, 1000);
    }
}
exports.WebpackInterceptor = WebpackInterceptor;
// Create and export the singleton instance
exports.webpackInterceptor = new WebpackInterceptor();
// Export common filter helpers
exports.filters = {
    // Find a module by property names
    byProps: (...props) => {
        return (m) => m && props.every(p => m[p] !== undefined);
    },
    // Find a module by function code
    byCode: (...code) => {
        return (m) => {
            if (typeof m !== "function")
                return false;
            const fnStr = Function.prototype.toString.call(m);
            return code.every(c => typeof c === "string"
                ? fnStr.includes(c)
                : c.test(fnStr));
        };
    },
    // Find a component by display name
    byDisplayName: (name) => {
        return (m) => {
            if (!m)
                return false;
            if (m.displayName === name)
                return true;
            if (m.default && m.default.displayName === name)
                return true;
            return false;
        };
    }
};
//# sourceMappingURL=webpack.js.map