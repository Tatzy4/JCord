"use strict";
// JaneczekCord Feature System
// Handles registration and lifecycle of features/plugins
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureRegistry = void 0;
exports.registerFeature = registerFeature;
// Feature registry - manages all features
class FeatureRegistry {
    constructor() {
        this.features = new Map();
        this.enabled = new Set();
        this.settings = new Map();
        this.loadSettings();
    }
    // Register a new feature
    register(feature) {
        if (!feature.name) {
            throw new Error('[JC:Features] Features must have a name');
        }
        if (this.features.has(feature.name)) {
            console.warn(`[JC:Features] Feature "${feature.name}" is already registered`);
            return;
        }
        // Register the feature
        this.features.set(feature.name, feature);
        console.log(`[JC:Features] Registered feature: ${feature.name}`);
        // Enable if it was previously enabled
        if (this.enabled.has(feature.name)) {
            this.enableFeature(feature.name).catch(err => {
                console.error(`[JC:Features] Failed to enable feature "${feature.name}":`, err);
            });
        }
    }
    // Get all registered features
    getAll() {
        return Array.from(this.features.values());
    }
    // Check if a feature is enabled
    isEnabled(name) {
        return this.enabled.has(name);
    }
    // Enable a feature
    async enableFeature(name) {
        const feature = this.features.get(name);
        if (!feature) {
            console.warn(`[JC:Features] Feature "${name}" not found`);
            return false;
        }
        if (this.enabled.has(name)) {
            return true; // Already enabled
        }
        // Start the feature
        if (feature.onStart) {
            try {
                await feature.onStart();
            }
            catch (err) {
                console.error(`[JC:Features] Error starting feature "${name}":`, err);
                return false;
            }
        }
        // Mark as enabled
        this.enabled.add(name);
        console.log(`[JC:Features] Enabled feature: ${name}`);
        // Save settings
        this.saveSettings();
        return true;
    }
    // Disable a feature
    async disableFeature(name) {
        const feature = this.features.get(name);
        if (!feature) {
            console.warn(`[JC:Features] Feature "${name}" not found`);
            return false;
        }
        if (!this.enabled.has(name)) {
            return true; // Already disabled
        }
        // Stop the feature
        if (feature.onStop) {
            try {
                await feature.onStop();
            }
            catch (err) {
                console.error(`[JC:Features] Error stopping feature "${name}":`, err);
                return false;
            }
        }
        // Mark as disabled
        this.enabled.delete(name);
        console.log(`[JC:Features] Disabled feature: ${name}`);
        // Save settings
        this.saveSettings();
        return true;
    }
    // Get a setting value
    getSetting(featureName, settingId) {
        const featureSettings = this.settings.get(featureName);
        if (!featureSettings) {
            const feature = this.features.get(featureName);
            if (!feature?.settings?.options)
                return undefined;
            const option = feature.settings.options.find(opt => opt.id === settingId);
            return option?.default;
        }
        if (featureSettings.has(settingId)) {
            return featureSettings.get(settingId);
        }
        // Return default value if no custom value is set
        const feature = this.features.get(featureName);
        if (!feature?.settings?.options)
            return undefined;
        const option = feature.settings.options.find(opt => opt.id === settingId);
        return option?.default;
    }
    // Update a setting value
    updateSetting(featureName, settingId, value) {
        const feature = this.features.get(featureName);
        if (!feature) {
            console.warn(`[JC:Features] Feature "${featureName}" not found`);
            return;
        }
        // Initialize settings map if needed
        if (!this.settings.has(featureName)) {
            this.settings.set(featureName, new Map());
        }
        // Update setting
        this.settings.get(featureName).set(settingId, value);
        // Notify feature of change
        if (feature.settings?.onChange) {
            feature.settings.onChange(settingId, value);
        }
        // Save settings
        this.saveSettings();
    }
    // Load settings from localStorage
    loadSettings() {
        try {
            // Load enabled features
            const enabledJson = localStorage.getItem('jc:features:enabled');
            if (enabledJson) {
                const enabledList = JSON.parse(enabledJson);
                if (Array.isArray(enabledList)) {
                    this.enabled = new Set(enabledList);
                }
            }
            // Load feature settings
            const settingsJson = localStorage.getItem('jc:features:settings');
            if (settingsJson) {
                const settingsObj = JSON.parse(settingsJson);
                for (const [featureName, settings] of Object.entries(settingsObj)) {
                    const settingsMap = new Map(Object.entries(settings));
                    this.settings.set(featureName, settingsMap);
                }
            }
        }
        catch (err) {
            console.error('[JC:Features] Error loading settings:', err);
        }
    }
    // Save settings to localStorage
    saveSettings() {
        try {
            // Save enabled features
            const enabledList = Array.from(this.enabled);
            localStorage.setItem('jc:features:enabled', JSON.stringify(enabledList));
            // Save feature settings
            const settingsObj = {};
            for (const [featureName, settingsMap] of this.settings.entries()) {
                settingsObj[featureName] = Object.fromEntries(settingsMap);
            }
            localStorage.setItem('jc:features:settings', JSON.stringify(settingsObj));
        }
        catch (err) {
            console.error('[JC:Features] Error saving settings:', err);
        }
    }
}
// Create and export the feature registry singleton
exports.featureRegistry = new FeatureRegistry();
// Function to register a feature
function registerFeature(feature) {
    exports.featureRegistry.register(feature);
}
//# sourceMappingURL=index.js.map