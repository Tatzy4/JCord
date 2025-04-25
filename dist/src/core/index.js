"use strict";
// JaneczekCord Core Module
// Main entry point for core functionality
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchComponent = exports.DevTools = exports.LazyComponent = exports.findModules = exports.getModuleByDisplayName = exports.getModuleByProps = exports.getModule = exports.moduleRegistry = exports.filters = exports.webpackInterceptor = void 0;
exports.initializeCore = initializeCore;
// Simple logging to avoid styling issues
function safeLog(area, message) {
    console.log(`[JaneczekCord][${area}] ${message}`);
}
// Import from webpack.ts (with error handling)
let webpackInterceptor;
let filters;
try {
    const webpackModule = require('./webpack');
    exports.webpackInterceptor = webpackInterceptor = webpackModule.webpackInterceptor;
    exports.filters = filters = webpackModule.filters;
    safeLog('Core', 'Webpack module loaded successfully');
}
catch (err) {
    safeLog('Core', `Error loading webpack module: ${err}`);
    // Fallback empty implementations
    exports.webpackInterceptor = webpackInterceptor = { isReady: () => false };
    exports.filters = filters = {
        byProps: (...props) => () => false,
        byCode: (...code) => () => false,
        byDisplayName: (name) => () => false
    };
}
// Import from modules.ts (with error handling)
let moduleRegistry;
let getModule;
let getModuleByProps;
let getModuleByDisplayName;
let findModules;
try {
    const modulesModule = require('./modules');
    exports.moduleRegistry = moduleRegistry = modulesModule.moduleRegistry;
    exports.getModule = getModule = modulesModule.getModule;
    exports.getModuleByProps = getModuleByProps = modulesModule.getModuleByProps;
    exports.getModuleByDisplayName = getModuleByDisplayName = modulesModule.getModuleByDisplayName;
    exports.findModules = findModules = modulesModule.findModules;
    safeLog('Core', 'Modules module loaded successfully');
}
catch (err) {
    safeLog('Core', `Error loading modules module: ${err}`);
    // Fallback empty implementations
    exports.moduleRegistry = moduleRegistry = {
        get: () => null,
        getComponent: () => null,
        register: () => { },
        registerComponent: () => { },
        subscribe: () => () => { }
    };
    exports.getModule = getModule = () => null;
    exports.getModuleByProps = getModuleByProps = () => null;
    exports.getModuleByDisplayName = getModuleByDisplayName = () => null;
    exports.findModules = findModules = () => [];
}
// Import from react.ts (with error handling)
let LazyComponent;
let DevTools;
let patchComponent;
try {
    const reactModule = require('./react');
    exports.LazyComponent = LazyComponent = reactModule.LazyComponent;
    exports.DevTools = DevTools = reactModule.DevTools;
    exports.patchComponent = patchComponent = reactModule.patchComponent;
    safeLog('Core', 'React module loaded successfully');
}
catch (err) {
    safeLog('Core', `Error loading react module: ${err}`);
    // Fallback empty implementations
    exports.LazyComponent = LazyComponent = () => () => null;
    exports.DevTools = DevTools = {
        findComponents: () => ({}),
        inspectElement: () => null,
        getComponentByName: () => null
    };
    exports.patchComponent = patchComponent = () => () => { };
}
// Initialize core
function initializeCore() {
    safeLog('Core', 'Initializing JaneczekCord core...');
    try {
        // Add a global object for debugging and access from the console
        window.JC = {
            // Core exports
            webpack: webpackInterceptor,
            modules: moduleRegistry,
            // Utils
            getModule,
            getModuleByProps,
            getModuleByDisplayName,
            findModules,
            LazyComponent,
            DevTools,
            // Function to check initialization status
            status: () => {
                const React = moduleRegistry.get('React');
                const ReactDOM = moduleRegistry.get('ReactDOM');
                return {
                    webpackReady: webpackInterceptor.isReady(),
                    reactLoaded: !!React,
                    reactDOMLoaded: !!ReactDOM,
                    reactVersion: React?.version || 'Not loaded',
                    moduleCount: Object.keys(moduleRegistry.modules || {}).length,
                    componentCount: Object.keys(moduleRegistry.components || {}).length
                };
            }
        };
        safeLog('Core', 'Core initialization completed successfully');
    }
    catch (err) {
        safeLog('Core', `Error during core initialization: ${err}`);
    }
}
//# sourceMappingURL=index.js.map