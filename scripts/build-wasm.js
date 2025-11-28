#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const wasmDir = path.join(__dirname, '..', 'wasm-ascii');
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
  return fs.existsSync(pkgDir) && fs.existsSync(wasmFile);
}

// Main build logic
function buildWasm() {
  process.chdir(wasmDir);

  if (hasWasmPack()) {
    console.log('Building WASM package with wasm-pack...');
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
    console.error('  Please install wasm-pack with: cargo install wasm-pack');
    console.error('  Or ensure the WASM package is built in wasm-ascii/pkg/');
    process.exit(1);
  }
}

buildWasm();

