"use strict";
// JaneczekCord Preload - Runs when Discord window starts
// This file is injected into Discord to add our modifications
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Enhanced logging function with consistent background style
function log(module, message) {
    // Colors for consistent background style
    const colors = {
        main: 'background: #5865F2; color: white; border-radius: 3px; padding: 1px 3px; font-weight: bold',
        module: 'background: #3ba55c; color: white; border-radius: 3px; padding: 1px 3px; font-weight: bold',
        reset: ''
    };
    // Log with consistent styling
    console.log(`%c JC %c ${module} %c ${message}`, colors.main, colors.module, colors.reset);
}
// Ensure JaneczekCord runs first by adding priority code
(function enforceJaneczekCordPriority() {
    // This self-executing function runs first and ensures JaneczekCord has highest priority
    // 1. Create a mutex to prevent Discord from loading first
    const JANECZEKCORD_RUNNING = Symbol('JANECZEKCORD_RUNNING');
    window[JANECZEKCORD_RUNNING] = true;
    // 2. Store original setTimeout to prevent any race conditions
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function (callback, timeout, ...args) {
        // If JaneczekCord is still initializing, delay all other setTimeout calls
        if (window[JANECZEKCORD_RUNNING] && timeout < 1000) {
            timeout = 1000; // Force other code to wait for JaneczekCord
        }
        return originalSetTimeout.call(this, callback, timeout, ...args);
    };
    // 3. When JaneczekCord is done, we'll release the mutex
    window.addEventListener('JaneczekCordReady', () => {
        delete window[JANECZEKCORD_RUNNING];
        window.setTimeout = originalSetTimeout;
    }, { once: true });
    log('Core', 'Priority enforced');
})();
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
    DevTools: {
        findComponents: (filter = '') => {
            const components = {};
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
            if (!window.React) {
                console.error('React not found yet');
                return null;
            }
            try {
                let fiber = null;
                // Try different React internal property patterns
                for (const key in element) {
                    if (key.startsWith('__reactFiber') ||
                        key.startsWith('__reactInternalInstance')) {
                        fiber = element[key];
                        break;
                    }
                }
                if (!fiber) {
                    console.error('Could not find React fiber on element');
                    return null;
                }
                // Walk up the fiber tree to find component instances
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
            }
            catch (e) {
                console.error('Error inspecting component:', e);
                return null;
            }
        },
        getComponentByName: (name) => {
            return window.DiscordComponents?.[name] || null;
        }
    }
};
// Create global placeholder for DiscordComponents
window.DiscordComponents = {};
// Load Discord's original preload
function loadOriginalPreload() {
    try {
        const originalPreload = process.env.DISCORD_ORIGINAL_PRELOAD;
        if (originalPreload) {
            log('Patcher', `Loading Discord original preload from: ${originalPreload}`);
            require(originalPreload);
        }
        else {
            log('Patcher', 'No original preload path found');
        }
    }
    catch (err) {
        console.error('Error loading Discord preload:', err);
    }
}
// Show banner in console - with consistent style
function showBanner() {
    console.log('%c JaneczekCord %c v1.0.0 ', 'color: white; background: #5865F2; font-weight: bold; padding: 2px 4px; border-radius: 3px;', 'color: white; background: #3ba55c; font-weight: bold; padding: 2px 4px; border-radius: 3px;');
}
// Early Sentry blocking using enhanced approach
function blockSentryEarly() {
    log('Security', 'Initializing privacy protection');
    // Block Sentry script loading by intercepting any script tag
    const originalCreateElement = document.createElement;
    document.createElement = function (tagName) {
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
        set(globalObj) {
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
    window.fetch = function (input, init) {
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
function blockAnalytics() {
    // Wait briefly for Discord's JS to load, then try to block analytics
    setTimeout(() => {
        try {
            const win = window;
            // Block AnalyticsActionHandlers
            if (win.AnalyticsActionHandlers && win.AnalyticsActionHandlers.handle) {
                win._originalAnalyticsHandle = win.AnalyticsActionHandlers.handle;
                win.AnalyticsActionHandlers.handle = () => { };
                log('Security', 'Blocked Discord analytics handlers');
            }
            // Block metrics
            if (win.METRICS || win._METRICS) {
                const metrics = win.METRICS || win._METRICS;
                if (metrics) {
                    ['increment', 'track', 'trackEvent', 'distribution'].forEach(method => {
                        if (typeof metrics[method] === 'function') {
                            metrics[method] = () => { };
                        }
                    });
                    if (metrics._intervalId) {
                        clearInterval(metrics._intervalId);
                        metrics._intervalId = undefined;
                    }
                    log('Security', 'Blocked Discord metrics collection');
                }
            }
        }
        catch (error) {
            log('Error', 'Analytics blocking failed: ' + error);
        }
    }, 1000);
}
// --- VENCORD-STYLE REACT CAPTURE IMPLEMENTATION ---
// Define global variables for React and its hooks
let React;
let ReactDOM;
let useState;
let useEffect;
let useLayoutEffect;
let useMemo;
let useRef;
let useReducer;
let useCallback;
// Helper for resolving the ready promise
let _resolveReady;
const onceReady = new Promise(r => _resolveReady = r);
// Storage for webpack modules
let wreq;
let cache;
const waitForSubscriptions = new Map();
const moduleListeners = new Set();
const factoryListeners = new Set();
// Function to initialize webpack
function _initWebpack(webpackRequire) {
    wreq = webpackRequire;
    cache = webpackRequire.c;
    Object.defineProperty(webpackRequire.c, Symbol.toStringTag, {
        value: "ModuleCache",
        configurable: true,
        writable: true,
        enumerable: false
    });
    log('React', 'Webpack initialized');
}
// Wait for a module to be loaded
// Poprawiona funkcja waitFor z obsługą różnych typów filtrów
function waitFor(filter, callback, { isIndirect = false } = {}) {
    // Konwertujemy filtr na funkcję FilterFn
    let filterFn;
    if (typeof filter === "string") {
        filterFn = (m) => m[filter] !== undefined;
    }
    else if (Array.isArray(filter)) {
        filterFn = (m) => filter.every(p => m[p] !== undefined);
    }
    else if (typeof filter === "function") {
        filterFn = filter;
    }
    else {
        throw new Error("filter must be a string, string[] or function, got " + typeof filter);
    }
    if (cache != null) {
        // Sprawdzamy czy moduł już jest załadowany
        for (const key in cache) {
            const mod = cache[key];
            if (!mod?.loaded || mod.exports == null)
                continue;
            if (filterFn(mod.exports)) {
                return void callback(mod.exports, key);
            }
            if (typeof mod.exports !== "object")
                continue;
            for (const nestedMod in mod.exports) {
                const nested = mod.exports[nestedMod];
                if (nested && filterFn(nested)) {
                    return void callback(nested, key);
                }
            }
        }
    }
    // Dodajemy do subskrypcji aby poczekać na załadowanie modułu
    waitForSubscriptions.set(filterFn, callback);
    log('React', `Waiting for module: ${filterFn.toString().substring(0, 30)}...`);
}
// Hook webpack
function setupWebpackHook() {
    log('React', 'Setting up Vencord-style webpack module hook');
    // Look for webpack system
    const webpackChunkName = Object.keys(window).find(key => key.startsWith('webpackChunk') && Array.isArray(window[key]));
    if (!webpackChunkName) {
        log('React', 'webpackChunk not found, will try alternative methods');
        return;
    }
    // Define a setter for the module to intercept webpack
    Object.defineProperty(Function.prototype, "m", {
        configurable: true,
        enumerable: false,
        set(originalModules) {
            // Restore normal property descriptor
            Object.defineProperty(this, "m", { value: originalModules });
            const { stack } = new Error();
            if (!stack?.includes("http") || stack.match(/at \d+? \(/) || !String(this).includes("exports:{}")) {
                return;
            }
            const fileName = stack.match(/\/assets\/(.+?\.js)/)?.[1];
            // Define a setter for the bundlePath property
            Object.defineProperty(this, "p", {
                enumerable: false,
                set(bundlePath) {
                    Object.defineProperty(this, "p", { value: bundlePath });
                    if (bundlePath !== "/assets/") {
                        return;
                    }
                    if (wreq == null && this.c != null) {
                        log('React', `Main WebpackInstance found in ${fileName}, initializing`);
                        _initWebpack(this);
                        // Set up React capture
                        setupReactCapture();
                    }
                }
            });
            log('React', 'Module setter hook installed');
        }
    });
    log('React', 'Webpack module hook set up successfully');
}
// Actual React capture
function setupReactCapture() {
    log('React', 'Setting up React capture');
    // First, locate React and ReactDOM
    waitFor("useState", m => {
        React = m;
        ({ useEffect, useState, useLayoutEffect, useMemo, useRef, useReducer, useCallback } = React);
        window.JC.React = React;
        window.React = React;
        log('React', 'React captured successfully!');
    });
    waitFor(["createPortal", "render"], m => {
        ReactDOM = m;
        window.JC.ReactDOM = ReactDOM;
        window.ReactDOM = ReactDOM;
        log('React', 'ReactDOM captured successfully!');
    });
    // Set up callback for CONNECTION_OPEN event to mark the ready state
    const fluxDispatcherCheck = setInterval(() => {
        const FluxDispatcher = window.JC.getModuleByProps?.('dispatch', 'subscribe');
        if (FluxDispatcher) {
            clearInterval(fluxDispatcherCheck);
            const cb = () => {
                FluxDispatcher.unsubscribe("CONNECTION_OPEN", cb);
                _resolveReady();
                log('React', 'Discord connection ready');
            };
            FluxDispatcher.subscribe("CONNECTION_OPEN", cb);
            log('React', 'Set up ready state detection');
        }
    }, 500);
    // Set up module finder utilities 
    const utilsCheck = setInterval(() => {
        if (wreq && wreq.c) {
            clearInterval(utilsCheck);
            // Find modules function
            window.JC.findModules = (filter) => {
                const modules = [];
                for (const id in wreq.c) {
                    const module = wreq.c[id]?.exports;
                    if (module && filter(module)) {
                        modules.push(module);
                    }
                }
                return modules;
            };
            // Get single module
            window.JC.getModule = (filter) => {
                for (const id in wreq.c) {
                    const module = wreq.c[id]?.exports;
                    if (module && filter(module)) {
                        return module;
                    }
                }
                return null;
            };
            // Get module by props
            window.JC.getModuleByProps = (...props) => {
                return window.JC.getModule(m => {
                    if (!m)
                        return false;
                    return props.every(prop => m[prop] !== undefined);
                });
            };
            // Get module by display name
            window.JC.getModuleByDisplayName = (name) => {
                return window.JC.getModule(m => {
                    if (!m)
                        return false;
                    if (m.default && m.default.displayName === name)
                        return true;
                    if (m.displayName === name)
                        return true;
                    return false;
                });
            };
            // Store webpack require
            window.JC.webpackRequire = wreq;
            log('React', 'Created webpack module utilities');
        }
    }, 500);
    // Hook into module loading to collect exported components
    moduleListeners.add((exports, id) => {
        try {
            // Look for React components by displayName
            if (exports && typeof exports === 'object') {
                // Check for direct exports with displayName
                if (exports.displayName && typeof exports === 'function') {
                    window.DiscordComponents[exports.displayName] = exports;
                }
                // Check for default export with displayName
                if (exports.default?.displayName && typeof exports.default === 'function') {
                    window.DiscordComponents[exports.default.displayName] = exports.default;
                }
                // Check nested exports
                for (const key in exports) {
                    if (exports[key]?.displayName && typeof exports[key] === 'function') {
                        window.DiscordComponents[exports[key].displayName] = exports[key];
                    }
                }
            }
        }
        catch (e) {
            // Ignore errors
        }
    });
}
// Expose JaneczekCord API 
function exposeAPI() {
    try {
        electron_1.contextBridge.exposeInMainWorld('JC', window.JC);
        electron_1.contextBridge.exposeInMainWorld('$JC', window.JC);
        electron_1.contextBridge.exposeInMainWorld('$r', (element) => window.JC.DevTools.inspectComponent(element));
        electron_1.contextBridge.exposeInMainWorld('$components', (filter) => window.JC.DevTools.findComponents(filter));
        log('Core', 'API exposed to renderer process');
    }
    catch (error) {
        log('Error', 'API exposure failed: ' + error);
    }
}
// Add helpful React DevTools console messages
function addDevToolsHelp() {
    setTimeout(() => {
        console.log('%c JaneczekCord DevTools %c Use these commands to inspect React:', 'color: white; background: #5865F2; font-weight: bold; padding: 2px 4px; border-radius: 3px;', 'color: white; background: #3ba55c; font-weight: bold; padding: 2px 4px; border-radius: 3px;');
        console.log('• %c$JC%c - Access the JaneczekCord API', 'font-weight:bold', 'font-weight:normal');
        console.log('• %c$components()%c - List all Discord components', 'font-weight:bold', 'font-weight:normal');
        console.log('• %c$components("button")%c - Find components by name', 'font-weight:bold', 'font-weight:normal');
        console.log('• %c$r(element)%c - Inspect a DOM element\'s React components', 'font-weight:bold', 'font-weight:normal');
        console.log('• %cwindow.React%c - Direct access to React API', 'font-weight:bold', 'font-weight:normal');
        console.log('• %cwindow.ReactDOM%c - Direct access to ReactDOM API', 'font-weight:bold', 'font-weight:normal');
    }, 5000); // Wait for Discord to fully load
}
// Initialize JaneczekCord
function initJaneczekCord() {
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
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
            catch (error) {
                log('Error', 'Failed to replace Discord logo: ' + error);
            }
        }, 1000);
        // Add DevTools help message
        addDevToolsHelp();
        // Signal that JaneczekCord is ready
        window.dispatchEvent(new Event('JaneczekCordReady'));
        log('Core', 'JaneczekCord initialization complete');
    }
    catch (error) {
        log('Error', 'Initialization failed: ' + error);
    }
}
// Start loading process - JaneczekCord runs FIRST
try {
    log('Core', 'JaneczekCord starting up');
    // 1. Install Sentry blocking
    blockSentryEarly();
    // 2. Set up Vencord-style webpack module hook for React capture
    setupWebpackHook();
    // 3. Block Discord analytics
    blockAnalytics();
    // 4. Load Discord's original preload
    loadOriginalPreload();
    // 5. Expose JaneczekCord API 
    exposeAPI();
    // 6. Initialize JaneczekCord UI when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initJaneczekCord);
    }
    else {
        initJaneczekCord();
    }
}
catch (error) {
    log('Error', 'Critical initialization error: ' + error);
}
//# sourceMappingURL=preload.js.map