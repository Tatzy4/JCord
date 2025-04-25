// JaneczekCord DevTools Feature
// Adds developer tools and useful utilities

import { registerFeature } from '../index';
import { patchComponent, moduleRegistry } from '../../core';

// Define the feature
registerFeature({
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
function handleKeyDown(event: KeyboardEvent): void {
  // Ctrl+Shift+I to open DevTools
  if (event.ctrlKey && event.shiftKey && event.key === 'I') {
    // Check if we have access to electron remote
    const remote = (window as any).require?.('electron')?.remote;
    if (remote) {
      const currentWindow = remote.getCurrentWindow();
      if (currentWindow) {
        currentWindow.webContents.openDevTools();
      }
    }
  }
}

// Patch the context menu
async function patchContextMenu(): Promise<void> {
  // Wait for React to be available
  await new Promise<void>(resolve => {
    if (moduleRegistry.get('React')) {
      resolve();
      return;
    }
    
    moduleRegistry.subscribe('React', () => resolve());
  });
  
  // Define a component patch
  const patchMenuComponent = (original: any) => {
    const React = moduleRegistry.get('React');
    
    // Return a wrapper component
    return function DevToolsContextMenuWrapper(props: any) {
      // Call the original component
      const originalResult = original(props);
      
      // Add our custom menu items
      if (originalResult && originalResult.props && originalResult.props.children) {
        // Create a new section
        const inspectItem = React.createElement('div', {
          className: 'item-1Yvehc',
          onClick: () => {
            console.log('Inspecting element:', props.target);
            const result = (window as any).JC.DevTools.inspectElement(props.target);
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
  patchComponent(ContextMenuComponent, patchMenuComponent);
}