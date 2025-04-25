// JaneczekCord Core Module
// Main entry point for core functionality

// Simple logging to avoid styling issues
function safeLog(area: string, message: string): void {
    console.log(`[JaneczekCord][${area}] ${message}`);
  }
  
  // Import from webpack.ts (with error handling)
  let webpackInterceptor: any;
  let filters: any;
  
  try {
    const webpackModule = require('./webpack');
    webpackInterceptor = webpackModule.webpackInterceptor;
    filters = webpackModule.filters;
    safeLog('Core', 'Webpack module loaded successfully');
  } catch (err) {
    safeLog('Core', `Error loading webpack module: ${err}`);
    // Fallback empty implementations
    webpackInterceptor = { isReady: () => false };
    filters = {
      byProps: (...props: string[]) => () => false,
      byCode: (...code: Array<string | RegExp>) => () => false,
      byDisplayName: (name: string) => () => false
    };
  }
  
  // Import from modules.ts (with error handling)
  let moduleRegistry: any;
  let getModule: any;
  let getModuleByProps: any;
  let getModuleByDisplayName: any;
  let findModules: any;
  
  try {
    const modulesModule = require('./modules');
    moduleRegistry = modulesModule.moduleRegistry;
    getModule = modulesModule.getModule;
    getModuleByProps = modulesModule.getModuleByProps;
    getModuleByDisplayName = modulesModule.getModuleByDisplayName;
    findModules = modulesModule.findModules;
    safeLog('Core', 'Modules module loaded successfully');
  } catch (err) {
    safeLog('Core', `Error loading modules module: ${err}`);
    // Fallback empty implementations
    moduleRegistry = {
      get: () => null,
      getComponent: () => null,
      register: () => {},
      registerComponent: () => {},
      subscribe: () => () => {}
    };
    getModule = () => null;
    getModuleByProps = () => null;
    getModuleByDisplayName = () => null;
    findModules = () => [];
  }
  
  // Import from react.ts (with error handling)
  let LazyComponent: any;
  let DevTools: any;
  let patchComponent: any;
  
  try {
    const reactModule = require('./react');
    LazyComponent = reactModule.LazyComponent;
    DevTools = reactModule.DevTools;
    patchComponent = reactModule.patchComponent;
    safeLog('Core', 'React module loaded successfully');
  } catch (err) {
    safeLog('Core', `Error loading react module: ${err}`);
    // Fallback empty implementations
    LazyComponent = () => () => null;
    DevTools = {
      findComponents: () => ({}),
      inspectElement: () => null,
      getComponentByName: () => null
    };
    patchComponent = () => () => {};
  }
  
  // Export everything
  export { 
    webpackInterceptor,
    filters,
    moduleRegistry,
    getModule,
    getModuleByProps,
    getModuleByDisplayName,
    findModules,
    LazyComponent,
    DevTools,
    patchComponent
  };
  
  // Initialize core
  export function initializeCore(): void {
    safeLog('Core', 'Initializing JaneczekCord core...');
    
    try {
      // Add a global object for debugging and access from the console
      (window as any).JC = {
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
    } catch (err) {
      safeLog('Core', `Error during core initialization: ${err}`);
    }
  }