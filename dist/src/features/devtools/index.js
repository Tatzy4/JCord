"use strict";
// JaneczekCord DevTools Feature
// Adds developer tools and useful utilities
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const core_1 = require("../../core");
// Define the feature
(0, index_1.registerFeature)({
    name: 'DevTools',
    description: 'Adds developer tools and utilities for debugging',
    version: '1.0.0',
    author: 'JaneczekCord Team',
    // Settings
    settings: {
        options: [
            {
                id: 'enableInspector',
                name: 'Component Inspector',
                description: 'Adds a component inspector to the context menu',
                type: 'toggle',
                default: true
            },
            {
                id: 'showComponentNames',
                name: 'Show Component Names',
                description: 'Show component names on hover (useful for development)',
                type: 'toggle',
                default: false
            }
        ],
        // Handle settings changes
        onChange: (settingId, value) => {
            console.log(`[DevTools] Setting "${settingId}" changed to:`, value);
        }
    },
    // Start the feature
    onStart: async () => {
        console.log('[DevTools] Starting...');
        // Add global keyboard shortcuts
        document.addEventListener('keydown', handleKeyDown);
        // Wait for React and patch components
        await patchContextMenu();
        console.log('[DevTools] Started successfully');
    },
    // Stop the feature
    onStop: async () => {
        // Remove keyboard shortcuts
        document.removeEventListener('keydown', handleKeyDown);
        console.log('[DevTools] Stopped');
    }
});
// Handle keyboard shortcuts
function handleKeyDown(event) {
    // Ctrl+Shift+I to open DevTools
    if (event.ctrlKey && event.shiftKey && event.key === 'I') {
        // Check if we have access to electron remote
        const remote = window.require?.('electron')?.remote;
        if (remote) {
            const currentWindow = remote.getCurrentWindow();
            if (currentWindow) {
                currentWindow.webContents.openDevTools();
            }
        }
    }
}
// Patch the context menu
async function patchContextMenu() {
    // Wait for React to be available
    await new Promise(resolve => {
        if (core_1.moduleRegistry.get('React')) {
            resolve();
            return;
        }
        core_1.moduleRegistry.subscribe('React', () => resolve());
    });
    // Define a component patch
    const patchMenuComponent = (original) => {
        const React = core_1.moduleRegistry.get('React');
        // Return a wrapper component
        return function DevToolsContextMenuWrapper(props) {
            // Call the original component
            const originalResult = original(props);
            // Add our custom menu items
            if (originalResult && originalResult.props && originalResult.props.children) {
                // Create a new section
                const inspectItem = React.createElement('div', {
                    className: 'item-1Yvehc',
                    onClick: () => {
                        console.log('Inspecting element:', props.target);
                        const result = window.JC.DevTools.inspectElement(props.target);
                        console.log('Inspection result:', result);
                    }
                }, 'Inspect with JaneczekCord');
                // Add to the menu
                const children = originalResult.props.children;
                if (Array.isArray(children)) {
                    // Add a divider and our item
                    const divider = React.createElement('div', { className: 'separator-2I32lJ' });
                    originalResult.props.children = [...children, divider, inspectItem];
                }
            }
            return originalResult;
        };
    };
    // Find and patch the context menu component
    // (This is a placeholder - you would need to find the actual component)
    const ContextMenuComponent = 'ContextMenu';
    (0, core_1.patchComponent)(ContextMenuComponent, patchMenuComponent);
}
//# sourceMappingURL=index.js.map