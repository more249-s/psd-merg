const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
let sharp;
try {
  if (process.pkg) {
    const execDir = path.dirname(process.execPath);
    sharp = eval('require')(path.join(execDir, 'node_modules', 'sharp'));
  } else {
    sharp = eval('require')('sharp');
  }
} catch (err) {
  console.error('[FATAL WORKER ERROR]: Could not load "sharp" library.', err.message);
  process.exit(1);
}
const { writePsd } = require('ag-psd');

parentPort.on('message', async (task) => {
  const { rawPath, cleanPath, outPath, layerNames, resizeMode } = task;
  
  try {
    // 1. Get raw image dimensions
    const rawImage = sharp(rawPath);
    const rawMetadata = await rawImage.metadata();
    const rawWidth = rawMetadata.width;
    const rawHeight = rawMetadata.height;
    
    if (!rawWidth || !rawHeight) {
      throw new Error('Could not read RAW image metadata');
    }
    
    // 2. Load and process clean image
    let cleanImage = sharp(cleanPath);
    const cleanMetadata = await cleanImage.metadata();
    
    let cleanWidth = cleanMetadata.width;
    let cleanHeight = cleanMetadata.height;
    
    // Resize clean to match raw if sizes differ and resizeMode is enabled
    const needResize = resizeMode === 'clean-to-raw' && (cleanWidth !== rawWidth || cleanHeight !== rawHeight);
    
    if (needResize) {
      cleanImage = cleanImage.resize({
        width: rawWidth,
        height: rawHeight,
        fit: 'fill',
        kernel: 'lanczos3' // High-quality bicubic resampling
      });
      cleanWidth = rawWidth;
      cleanHeight = rawHeight;
    }
    
    // 3. Extract raw RGBA buffers
    const rawBuffer = await rawImage.ensureAlpha().raw().toBuffer();
    const cleanBuffer = await cleanImage.ensureAlpha().raw().toBuffer();
    
    // 4. Build PSD structure
    // Children array is ordered bottom-to-top, so RAW (bottom) comes first, followed by CLEAN (top)
    const psd = {
      width: rawWidth,
      height: rawHeight,
      children: [
        {
          name: layerNames.raw || 'RAW',
          left: 0,
          top: 0,
          right: rawWidth,
          bottom: rawHeight,
          opacity: 255,
          visible: true,
          imageData: {
            width: rawWidth,
            height: rawHeight,
            data: new Uint8Array(rawBuffer)
          }
        },
        {
          name: layerNames.clean || 'CLEAN',
          left: 0,
          top: 0,
          right: cleanWidth,
          bottom: cleanHeight,
          opacity: 255,
          visible: true,
          imageData: {
            width: cleanWidth,
            height: cleanHeight,
            data: new Uint8Array(cleanBuffer)
          }
        }
      ]
    };
    
    // 5. Generate and save PSD
    const psdBuffer = writePsd(psd);
    
    // Ensure output directory exists
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    fs.writeFileSync(outPath, Buffer.from(psdBuffer));
    
    parentPort.postMessage({ success: true, resized: needResize });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
});
