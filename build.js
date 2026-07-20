const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const pngToIco = require('png-to-ico');

async function build() {
  console.log('===================================================');
  console.log('Manga PSD Merger GUI - Build Tool');
  console.log('===================================================');
  
  try {
    // 1. Convert PNG icon to ICO
    console.log('[1/3] Normalizing app_icon.png with sharp and converting to ICO...');
    const pngPath = path.join(__dirname, 'app_icon.png');
    const tempPngPath = path.join(__dirname, 'app_icon_normalized.png');
    const icoPath = path.join(__dirname, 'app_icon.ico');
    
    if (!fs.existsSync(pngPath)) {
      throw new Error('app_icon.png not found in workspace root');
    }
    
    // Normalize using sharp to guarantee standard 8-bit PNG structure
    const sharp = require('sharp');
    await sharp(pngPath)
      .resize(128, 128) // Resize to 128x128 for high quality display on Windows
      .png()
      .toFile(tempPngPath);
      
    const icoBuffer = await pngToIco(tempPngPath);
    fs.writeFileSync(icoPath, icoBuffer);
    
    // Remove temp file
    if (fs.existsSync(tempPngPath)) {
      fs.unlinkSync(tempPngPath);
    }
    console.log('  [OK] Created app_icon.ico successfully.');

    const fetchedBinaryPath = path.join(os.homedir(), '.pkg-cache', 'v3.5', 'fetched-v20.18.0-win-x64');
    const builtBinaryPath = path.join(os.homedir(), '.pkg-cache', 'v3.5', 'built-v20.18.0-win-x64');
    
    // Ensure we have a clean fetched binary
    if (!fs.existsSync(fetchedBinaryPath)) {
      throw new Error(`Cached base Node.js binary not found. Please run pkg once to download it.`);
    }

    // Copy to "built-" to bypass hash checking
    console.log('[2/3] Copying to custom built binary to bypass hash check...');
    fs.copyFileSync(fetchedBinaryPath, builtBinaryPath);

    // Inject custom icon into the built binary
    console.log('      Injecting custom icon into built Node.js binary...');
    const reseditCmd = `npx resedit-cli --in "${builtBinaryPath}" --out "${builtBinaryPath}" --icon 1,app_icon.ico`;
    execSync(reseditCmd, { stdio: 'inherit' });
    console.log('  [OK] Custom built binary prepared.');

    // 3. Package Node app to EXE using pkg
    console.log('[3/3] Bundling application with pkg (using pre-patched built binary)...');
    const finalExePath = path.join(__dirname, 'manga-psd-merger-gui.exe');
    execSync(`npx pkg . --targets node20-win-x64 --output "${finalExePath}"`, { stdio: 'inherit' });
    console.log('  [OK] Standalone executable compiled.');

    // Cleanup temporary files
    console.log('---------------------------------------------------');
    console.log(`[SUCCESS] Output saved: ${finalExePath}`);
    console.log('===================================================');
  } catch (err) {
    console.error('[FATAL BUILD ERROR]:', err.message);
    process.exit(1);
  }
}

build();
