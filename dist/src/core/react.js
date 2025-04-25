"use strict";
// JaneczekCord React Utilities
// React-specific helper functions and component utilities
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevTools = void 0;
exports.LazyComponent = LazyComponent;
exports.patchComponent = patchComponent;
const modules_1 = require("./modules");
// Get React from the module registry
const getReact = () => modules_1.moduleRegistry.get('React');
const getReactDOM = () => modules_1.moduleRegistry.get('ReactDOM');
// Create a lazy component that loads when needed
function LazyComponent(factory, attempts = 5) {
    let tries = 0;
    let Component = null;
    const loadComponent = () => {
        if (Component !== null)
            return Component;
        if (tries >= attempts)
            return null;
        tries++;
        const result = factory();
        if (result !== undefined) {
            Component = result;
        }
        return Component;
    };
    // Create a React component that loads the real component on render
    const LazyWrapper = (props) => {
        const React = getReact();
        if (!React)
            return null;
        const LoadedComponent = loadComponent();
        if (!LoadedComponent)
            return null;
        return React.createElement(LoadedComponent, props);
    };
    // Add display name for debugging
    LazyWrapper.displayName = `LazyComponent(${factory.name || 'Anonymous'})`;
    return LazyWrapper;
}
// React DevTools utilities
exports.DevTools = {
    // Find components by name pattern
    findComponents: (filter = '') => {
        const components = {};
        const registry = modules_1.moduleRegistry['components'] || {};
        for (const name in registry) {
            if (filter === '' || name.toLowerCase().includes(filter.toLowerCase())) {
                components[name] = registry[name];
            }
        }
        return components;
    },
    // Inspect a DOM element to find React components
    inspectElement: (element) => {
        const React = getReact();
        if (!React)
            return null;
        try {
            // Find React Fiber
            let fiber = null;
            for (const key in element) {
                if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
                    fiber = element[key];
                    break;
                }
            }
            if (!fiber)
                return null;
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
        }
        catch (e) {
            console.error('[JC:React] Error inspecting element:', e);
            return null;
        }
    },
    // Get a component by display name
    getComponentByName: (name) => {
        return modules_1.moduleRegistry.getComponent(name);
    }
};
// Patch a React component
function patchComponent(name, patcher, options = {}) {
    // Wait for component to be available
    return modules_1.moduleRegistry.subscribe(name, (Component) => {
        if (!Component)
            return;
        const React = getReact();
        if (!React)
            return;
        // Create patched component
        const PatchedComponent = patcher(Component);
        // Set display name
        if (options.displayName) {
            PatchedComponent.displayName = options.displayName;
        }
        else {
            PatchedComponent.displayName = `JC(${Component.displayName || name})`;
        }
        // Replace in registry
        modules_1.moduleRegistry.register(name, PatchedComponent);
        console.log(`[JC:React] Patched component: ${name}`);
    });
}
//# sourceMappingURL=react.js.map