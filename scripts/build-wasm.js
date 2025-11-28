#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get absolute paths
const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, '..');
const wasmDir = path.join(projectRoot, 'wasm-ascii');
const pkgDir = path.join(wasmDir, 'pkg');
const wasmFile = path.join(pkgDir, 'wasm_ascii_bg.wasm');

// Check if wasm-pack is available
function hasWasmPack() {
  try {
    execSync('wasm-pack --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if WASM package already exists
function wasmPackageExists() {
  const pkgExists = fs.existsSync(pkgDir);
  const wasmExists = fs.existsSync(wasmFile);
  
  if (!pkgExists) {
    console.log(`Debug: pkg directory not found at: ${pkgDir}`);
    return false;
  }
  
  if (!wasmExists) {
    console.log(`Debug: WASM file not found at: ${wasmFile}`);
    // List what's actually in pkg directory
    try {
      const files = fs.readdirSync(pkgDir);
      console.log(`Debug: Files in pkg directory: ${files.join(', ')}`);
    } catch (e) {
      console.log(`Debug: Could not read pkg directory: ${e.message}`);
    }
    return false;
  }
  
  return true;
}

// Main build logic
function buildWasm() {
  console.log(`Building WASM from: ${wasmDir}`);
  console.log(`Checking for package at: ${pkgDir}`);
  
  // Change to wasm directory for building
  const originalCwd = process.cwd();
  
  try {
    if (!fs.existsSync(wasmDir)) {
      console.error(`✗ Error: wasm-ascii directory not found at: ${wasmDir}`);
      process.exit(1);
    }

    if (hasWasmPack()) {
      console.log('Building WASM package with wasm-pack...');
      process.chdir(wasmDir);
      try {
        execSync('wasm-pack build --target web --out-dir pkg --no-opt', {
          stdio: 'inherit',
        });
        console.log('✓ WASM package built successfully');
      } catch (error) {
        console.error('✗ Failed to build WASM package:', error.message);
        process.exit(1);
      }
    } else if (wasmPackageExists()) {
      console.log('✓ WASM package already exists, skipping build');
    } else {
      console.error('✗ Error: wasm-pack not found and WASM package is missing.');
      console.error(`  Expected WASM file at: ${wasmFile}`);
      console.error('  Please install wasm-pack with: cargo install wasm-pack');
      console.error('  Or ensure the WASM package is built in wasm-ascii/pkg/');
      console.error('  Note: Make sure wasm-ascii/pkg/ is committed to git if deploying');
      process.exit(1);
    }
  } finally {
    process.chdir(originalCwd);
  }
}

buildWasm();

