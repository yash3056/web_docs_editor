#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to build for a specific target
function buildForTarget(target, outputName) {
    console.log(`Building for ${target}...`);
    
    try {
        // Clean dist folder
        if (fs.existsSync('dist')) {
            fs.rmSync('dist', { recursive: true, force: true });
        }
        
        // Build with pkg
        const command = `npx pkg . --targets ${target} --out-path dist`;
        console.log(`Running: ${command}`);
        execSync(command, { stdio: 'inherit' });
        
        // Get the generated filename
        const distFiles = fs.readdirSync('dist');
        const generatedFile = distFiles.find(f => f.startsWith('web-docs-editor'));
        
        if (generatedFile) {
            const oldPath = path.join('dist', generatedFile);
            const newPath = path.join('dist', outputName);
            
            // Rename the file
            fs.renameSync(oldPath, newPath);
            console.log(`✓ Built ${outputName} successfully`);
            
            // Make executable on Unix systems
            if (process.platform !== 'win32') {
                fs.chmodSync(newPath, '755');
            }
        }
        
    } catch (error) {
        console.error(`✗ Failed to build ${target}:`, error.message);
        process.exit(1);
    }
}

// Main build function
function main() {
    const targets = {
        'node18-linux-x64': 'web-docs-editor-linux-x64',
        'node18-win-x64': 'web-docs-editor-windows-x64.exe',
        'node18-macos-x64': 'web-docs-editor-macos-x64',
        'node18-macos-arm64': 'web-docs-editor-macos-arm64'
    };
    
    const targetArg = process.argv[2];
    
    if (targetArg && targets[targetArg]) {
        buildForTarget(targetArg, targets[targetArg]);
    } else if (targetArg === 'all') {
        for (const [target, outputName] of Object.entries(targets)) {
            buildForTarget(target, outputName);
        }
    } else {
        console.log('Usage: node build.js <target>');
        console.log('Available targets:');
        Object.keys(targets).forEach(target => {
            console.log(`  ${target}`);
        });
        console.log('  all (builds all targets)');
        process.exit(1);
    }
}

main();