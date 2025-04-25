"use strict";
// JaneczekCord Installer
// Handles installation and uninstallation of JaneczekCord into Discord
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = inject;
exports.uninject = uninject;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const readline = __importStar(require("readline"));
const execPromise = (0, util_1.promisify)(child_process_1.exec);
// Generate simplified package.json for Discord
function generateDiscordPackageJson() {
    return JSON.stringify({
        name: "janeczekcord",
        main: "patcher.js",
        version: "1.0.0",
        description: "JaneczekCord - A modular Discord client modification",
        author: "JaneczekCord Team",
        license: "MIT"
    }, null, 2);
}
// Create readline interface for user input
function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}
// Ask user confirmation
async function askQuestion(question) {
    const rl = createInterface();
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.toLowerCase().startsWith('y'));
        });
    });
}
// Check if a file is locked
async function isFileLocked(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return false;
        }
        const fd = fs.openSync(filePath, 'r+');
        fs.closeSync(fd);
        return false;
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }
        if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
            return true;
        }
        throw err;
    }
}
// Check if Discord is running
async function isDiscordRunning() {
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execPromise('tasklist /FI "IMAGENAME eq Discord.exe" /NH');
            return stdout.includes('Discord.exe');
        }
        else if (process.platform === 'darwin') {
            const { stdout } = await execPromise('pgrep -x Discord');
            return stdout.trim() !== '';
        }
        else {
            const { stdout } = await execPromise('pgrep -x discord');
            return stdout.trim() !== '';
        }
    }
    catch (e) {
        // If the command fails, assume Discord is not running
        return false;
    }
}
// Get processes that are using Discord files (Windows only)
async function getProcessesLockingDiscord() {
    if (process.platform !== 'win32') {
        return []; // Only implemented for Windows for now
    }
    try {
        // Use Windows commands to find Discord processes
        const { stdout } = await execPromise('tasklist /FI "IMAGENAME eq Discord.exe" /FO CSV');
        const lines = stdout.split('\n').filter(line => line.includes('Discord'));
        const processes = lines.map(line => {
            const match = line.match(/"([^"]+)","(\d+)",/);
            if (match) {
                return { ProcessName: match[1], Id: parseInt(match[2]) };
            }
            return null;
        }).filter(Boolean);
        // Also look for Discord update processes
        const { stdout: updateStdout } = await execPromise('tasklist /FI "IMAGENAME eq DiscordUpdate.exe" /FO CSV');
        const updateLines = updateStdout.split('\n').filter(line => line.includes('DiscordUpdate'));
        updateLines.forEach(line => {
            const match = line.match(/"([^"]+)","(\d+)",/);
            if (match) {
                processes.push({ ProcessName: match[1], Id: parseInt(match[2]) });
            }
        });
        return processes;
    }
    catch (e) {
        console.error('Error detecting Discord processes:', e.message);
        return [];
    }
}
// Kill specific process by ID
async function killProcess(pid) {
    try {
        if (process.platform === 'win32') {
            await execPromise(`taskkill /F /PID ${pid}`);
        }
        else {
            await execPromise(`kill -9 ${pid}`);
        }
        return true;
    }
    catch (e) {
        console.error(`Failed to kill process ${pid}: ${e.message}`);
        return false;
    }
}
// Kill Discord processes
async function killDiscord() {
    console.log('Finding Discord processes...');
    // Check if Discord is running
    const isRunning = await isDiscordRunning();
    if (!isRunning) {
        console.log('Discord is not running.');
        return true;
    }
    // Get all Discord processes
    const processes = await getProcessesLockingDiscord();
    if (processes.length === 0) {
        console.log('No specific Discord processes detected. Trying generic approach...');
        const shouldClose = await askQuestion('Discord is running. Do you want to close it? (y/n): ');
        if (shouldClose) {
            console.log('Closing Discord...');
            try {
                if (process.platform === 'win32') {
                    await execPromise('taskkill /F /IM Discord.exe');
                    await execPromise('taskkill /F /IM DiscordUpdate.exe 2>nul');
                }
                else if (process.platform === 'darwin') {
                    await execPromise('pkill -x Discord');
                }
                else {
                    await execPromise('pkill -x discord');
                }
                // Wait to ensure Discord is fully closed
                console.log('Waiting for Discord to close completely...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                console.log('Discord has been closed.');
                return true;
            }
            catch (e) {
                console.error('Failed to close Discord:', e.message);
                return false;
            }
        }
        else {
            console.log('Operation cancelled at user request.');
            return false;
        }
    }
    // Show detected processes
    console.log('The following Discord processes are running:');
    processes.forEach((proc, index) => {
        console.log(`${index + 1}. ${proc.ProcessName} (PID: ${proc.Id})`);
    });
    // Ask for confirmation
    const shouldClose = await askQuestion('Do you want to close these processes? (y/n): ');
    if (!shouldClose) {
        console.log('Operation cancelled at user request.');
        return false;
    }
    console.log('Closing Discord processes...');
    // Kill each process
    let allSuccessful = true;
    for (const proc of processes) {
        console.log(`Closing ${proc.ProcessName} (PID: ${proc.Id})...`);
        const success = await killProcess(proc.Id);
        if (!success) {
            allSuccessful = false;
        }
    }
    if (allSuccessful) {
        // Wait to ensure processes are fully closed
        console.log('Waiting for all processes to close completely...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('All processes have been closed.');
    }
    else {
        console.log('Some processes could not be closed. You may need to close them manually.');
    }
    return allSuccessful;
}
// Find Discord installation directory
function findDiscordPath() {
    let discordPath;
    if (process.platform === 'win32') {
        // Windows: Check common installation paths
        const localAppData = process.env.LOCALAPPDATA;
        if (!localAppData)
            return undefined;
        const possiblePaths = [
            // Discord Stable
            path.join(localAppData, 'Discord'),
            // Discord PTB
            path.join(localAppData, 'DiscordPTB'),
            // Discord Canary
            path.join(localAppData, 'DiscordCanary')
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                discordPath = p;
                break;
            }
        }
    }
    else if (process.platform === 'darwin') {
        // macOS
        const possiblePaths = [
            '/Applications/Discord.app',
            '/Applications/Discord PTB.app',
            '/Applications/Discord Canary.app'
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                discordPath = p;
                break;
            }
        }
    }
    else if (process.platform === 'linux') {
        // Linux: Use which to find Discord binary
        try {
            const discordBin = (0, child_process_1.execSync)('which discord').toString().trim();
            if (discordBin) {
                discordPath = path.dirname(path.dirname(discordBin));
            }
        }
        catch (e) {
            // Discord not found in PATH
        }
    }
    return discordPath;
}
// Find the app directory inside Discord installation
function findAppDir(discordPath) {
    // Get the most recent app directory
    let appDirs;
    if (process.platform === 'win32') {
        appDirs = fs.readdirSync(discordPath)
            .filter(dir => dir.startsWith('app-'))
            .map(dir => path.join(discordPath, dir));
    }
    else if (process.platform === 'darwin') {
        appDirs = fs.readdirSync(path.join(discordPath, 'Contents', 'MacOS'))
            .filter(dir => dir.startsWith('app-'))
            .map(dir => path.join(discordPath, 'Contents', 'MacOS', dir));
    }
    else {
        appDirs = fs.readdirSync(discordPath)
            .filter(dir => dir.startsWith('app-'))
            .map(dir => path.join(discordPath, dir));
    }
    // Sort by modified date to get the most recent
    appDirs.sort((a, b) => {
        return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
    });
    return appDirs[0]; // Return the most recent
}
// Find resources directory
function findResourcesDir(appDir) {
    return path.join(appDir, 'resources');
}
// Wait for file to be unlocked
async function waitForFileUnlock(filePath, maxAttempts = 10) {
    console.log(`Waiting for file to be unlocked: ${filePath}`);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const isLocked = await isFileLocked(filePath);
        if (!isLocked) {
            console.log(`File is now unlocked after ${attempt} attempts`);
            return true;
        }
        console.log(`Attempt ${attempt}/${maxAttempts}: File is still locked, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(`File is still locked after ${maxAttempts} attempts`);
    return false;
}
// Recursively copy a directory
function copyDirectory(source, destination) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }
    // Get all files and directories in source
    const entries = fs.readdirSync(source, { withFileTypes: true });
    // Copy each entry
    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
            // Recursively copy directory
            copyDirectory(sourcePath, destPath);
        }
        else {
            // Copy file
            fs.copyFileSync(sourcePath, destPath);
        }
    }
}
// Function to inject JaneczekCord
async function inject() {
    console.log('Starting JaneczekCord injection...');
    const discordPath = findDiscordPath();
    if (!discordPath) {
        console.error('Could not find Discord installation');
        return;
    }
    console.log(`Found Discord at: ${discordPath}`);
    const appDir = findAppDir(discordPath);
    if (!appDir) {
        console.error('Could not find Discord app directory');
        return;
    }
    console.log(`Found Discord app directory: ${appDir}`);
    const resourcesDir = findResourcesDir(appDir);
    console.log(`Found Discord resources directory: ${resourcesDir}`);
    const appAsar = path.join(resourcesDir, 'app.asar');
    const backupAsar = path.join(resourcesDir, '_app.asar');
    // Check if already injected
    if (fs.existsSync(backupAsar)) {
        console.log('JaneczekCord is already injected');
        return;
    }
    // Check if Discord is running and close it if needed
    const discordClosed = await killDiscord();
    if (!discordClosed) {
        console.log('Please close Discord manually and try again.');
        return;
    }
    // Check if the file is locked
    const isLocked = await isFileLocked(appAsar);
    if (isLocked) {
        console.log('Discord files are still locked. Waiting for them to be released...');
        const unlocked = await waitForFileUnlock(appAsar);
        if (!unlocked) {
            console.log('Discord files are still locked. Please restart your computer and try again.');
            return;
        }
    }
    try {
        // Verify that compiled files exist
        const distDir = path.resolve('dist');
        const srcDir = path.join(distDir, 'src');
        // Check for main files
        const distPatcherPath = path.join(srcDir, 'patcher.js');
        const distPreloadPath = path.join(srcDir, 'preload.js');
        console.log(`Checking for: ${distPatcherPath}`);
        if (!fs.existsSync(distPatcherPath)) {
            console.error(`Error: Could not find ${distPatcherPath}`);
            console.error('Make sure you have compiled the TypeScript files with "npm run build"');
            return;
        }
        console.log(`Checking for: ${distPreloadPath}`);
        if (!fs.existsSync(distPreloadPath)) {
            console.error(`Error: Could not find ${distPreloadPath}`);
            console.error('Make sure you have compiled the TypeScript files with "npm run build"');
            return;
        }
        // Check for core modules
        const distCorePath = path.join(srcDir, 'core');
        if (!fs.existsSync(distCorePath)) {
            console.error(`Error: Could not find core modules at ${distCorePath}`);
            console.error('Make sure you have compiled the TypeScript files with "npm run build"');
            return;
        }
        // Check for features modules
        const distFeaturesPath = path.join(srcDir, 'features');
        if (!fs.existsSync(distFeaturesPath)) {
            console.error(`Error: Could not find features modules at ${distFeaturesPath}`);
            console.error('Make sure you have compiled the TypeScript files with "npm run build"');
            return;
        }
        // Backup original app.asar
        console.log(`Backing up ${appAsar} to ${backupAsar}`);
        fs.renameSync(appAsar, backupAsar);
        // Create app.asar directory
        console.log(`Creating directory: ${appAsar}`);
        fs.mkdirSync(appAsar);
        // Copy patcher.js to the root for Discord to find it
        console.log(`Copying ${distPatcherPath} to ${path.join(appAsar, 'patcher.js')}`);
        fs.copyFileSync(distPatcherPath, path.join(appAsar, 'patcher.js'));
        // Copy preload.js to the root
        console.log(`Copying ${distPreloadPath} to ${path.join(appAsar, 'preload.js')}`);
        fs.copyFileSync(distPreloadPath, path.join(appAsar, 'preload.js'));
        // Create and copy core directory structure
        console.log('Copying core modules...');
        const appAsarCorePath = path.join(appAsar, 'core');
        copyDirectory(distCorePath, appAsarCorePath);
        // Create and copy features directory structure
        console.log('Copying features modules...');
        const appAsarFeaturesPath = path.join(appAsar, 'features');
        copyDirectory(distFeaturesPath, appAsarFeaturesPath);
        // Copy API folder if it exists
        const distApiPath = path.join(srcDir, 'api');
        if (fs.existsSync(distApiPath)) {
            console.log('Copying API modules...');
            const appAsarApiPath = path.join(appAsar, 'api');
            copyDirectory(distApiPath, appAsarApiPath);
        }
        // Generate package.json with correct main path
        console.log(`Generating package.json for Discord`);
        const packageJson = generateDiscordPackageJson();
        fs.writeFileSync(path.join(appAsar, 'package.json'), packageJson);
        console.log('JaneczekCord has been injected successfully!');
        console.log('You can now start Discord to see the effects.');
    }
    catch (error) {
        console.error('Error during injection:', error.message);
        console.error('If the error is about "resource busy or locked", try restarting your computer and try again.');
    }
}
// Function to uninject JaneczekCord
async function uninject() {
    const discordPath = findDiscordPath();
    if (!discordPath) {
        console.error('Could not find Discord installation');
        return;
    }
    const appDir = findAppDir(discordPath);
    if (!appDir) {
        console.error('Could not find Discord app directory');
        return;
    }
    const resourcesDir = findResourcesDir(appDir);
    const appAsar = path.join(resourcesDir, 'app.asar');
    const backupAsar = path.join(resourcesDir, '_app.asar');
    // Check if backup exists (meaning JaneczekCord was installed)
    if (!fs.existsSync(backupAsar)) {
        console.log('JaneczekCord is not injected (no backup file found)');
        return;
    }
    // Check if Discord is running and close it if needed
    const discordClosed = await killDiscord();
    if (!discordClosed) {
        console.log('Please close Discord manually and try again.');
        return;
    }
    // Check if JaneczekCord directory exists
    const janeczekcordDirExists = fs.existsSync(appAsar) && fs.statSync(appAsar).isDirectory();
    // Check if files are locked
    const backupLocked = await isFileLocked(backupAsar);
    if (backupLocked) {
        console.log('Discord files are still locked. Waiting for them to be released...');
        const unlocked = await waitForFileUnlock(backupAsar);
        if (!unlocked) {
            console.log('Discord files are still locked. Please restart your computer and try again.');
            return;
        }
    }
    try {
        // Remove JaneczekCord files
        if (janeczekcordDirExists) {
            console.log('Removing JaneczekCord files...');
            fs.rmSync(appAsar, { recursive: true, force: true });
        }
        else if (fs.existsSync(appAsar)) {
            fs.unlinkSync(appAsar);
        }
        // Restore original app.asar
        console.log('Restoring original Discord app.asar...');
        fs.renameSync(backupAsar, appAsar);
        console.log('JaneczekCord has been uninjected successfully!');
        console.log('You can now start Discord normally.');
    }
    catch (error) {
        console.error('Error during uninjection:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Make sure Discord is completely closed (check Task Manager)');
        console.error('2. Try rebooting your computer to release any locked files');
        console.error('3. If you have antivirus software, check if it\'s blocking file operations');
    }
}
// Main function
function main() {
    // Process command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--inject')) {
        inject().catch(err => console.error('Installation failed:', err));
    }
    else if (args.includes('--uninject')) {
        uninject().catch(err => console.error('Uninstallation failed:', err));
    }
    else {
        console.log('Usage:');
        console.log('  node installer.js --inject     # Inject JaneczekCord into Discord');
        console.log('  node installer.js --uninject   # Remove JaneczekCord from Discord');
    }
}
// Run script directly if invoked as main
if (require.main === module) {
    main();
}
//# sourceMappingURL=installer.js.map