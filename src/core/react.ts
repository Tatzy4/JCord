// JaneczekCord React Utilities
// React-specific helper functions and component utilities

import { moduleRegistry } from './modules';

// Add React type declaration
declare namespace React {
  type ComponentType<P = any> = any;
  interface ReactElement {}
}

// Get React from the module registry
const getReact = () => moduleRegistry.get('React');
const getReactDOM = () => moduleRegistry.get('ReactDOM');

// Create a lazy component that loads when needed
export function LazyComponent<T extends object = any>(
  factory: () => any, 
  attempts = 5
): React.ComponentType<T> {
  let tries = 0;
  let Component: any = null;
  
  const loadComponent = () => {
    if (Component !== null) return Component;
    if (tries >= attempts) return null;
    
    tries++;
    const result = factory();
    if (result !== undefined) {
      Component = result;
    }
    
    return Component;
  };
  
  // Create a React component that loads the real component on render
  const LazyWrapper = (props: T) => {
    const React = getReact();
    if (!React) return null;
    
    const LoadedComponent = loadComponent();
    if (!LoadedComponent) return null;
    
    return React.createElement(LoadedComponent, props);
  };
  
  // Add display name for debugging
  LazyWrapper.displayName = `LazyComponent(${factory.name || 'Anonymous'})`;
  
  return LazyWrapper;
}

// React DevTools utilities
export const DevTools = {
  // Find components by name pattern
  findComponents: (filter = '') => {
    const components: Record<string, any> = {};
    const registry = (moduleRegistry as any)['components'] || {};
    
    for (const name in registry) {
      if (filter === '' || name.toLowerCase().includes(filter.toLowerCase())) {
        components[name] = registry[name];
      }
    }
    
    return components;
  },
  
  // Inspect a DOM element to find React components
  inspectElement: (element: any) => {
    const React = getReact();
    if (!React) return null;
    
    try {
      // Find React Fiber
      let fiber = null;
      for (const key in element) {
        if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
          fiber = element[key];
          break;
        }
      }
      
      if (!fiber) return null;
      
      // Walk up the fiber tree to find components
      let current = fiber;
      const components = [];
      
      while (current) {
        if (current.stateNode && typeof current.type !== 'string') {
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
      console.error('[JC:React] Error inspecting element:', e);
      return null;
    }
  },
  
  // Get a component by display name
  getComponentByName: (name: string) => {
    return moduleRegistry.getComponent(name);
  }
};

// Patch a React component
export function patchComponent(
  name: string, 
  patcher: (original: any) => any, 
  options: { displayName?: string } = {}
): () => void {
  // Wait for component to be available
  return moduleRegistry.subscribe(name, (Component) => {
    if (!Component) return;
    
    const React = getReact();
    if (!React) return;
    
    // Create patched component
    const PatchedComponent = patcher(Component);
    
    // Set display name
    if (options.displayName) {
      PatchedComponent.displayName = options.displayName;
    } else {
      PatchedComponent.displayName = `JC(${Component.displayName || name})`;
    }
    
    // Replace in registry
    moduleRegistry.register(name, PatchedComponent);
    
    console.log(`[JC:React] Patched component: ${name}`);
  });
}