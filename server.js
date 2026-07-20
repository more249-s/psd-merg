const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { Worker } = require('worker_threads');
let sharp;
try {
  if (process.pkg) {
    const execDir = path.dirname(process.execPath);
    sharp = eval('require')(path.join(execDir, 'node_modules', 'sharp'));
  } else {
    sharp = eval('require')('sharp');
  }
} catch (err) {
  console.error('[FATAL SERVER ERROR]: Could not load "sharp" library.', err.message);
  process.exit(1);
}
const open = require('open');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Resolve path for frontend assets, working both in dev mode and packaged .exe mode
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.use(express.json());

// API Settings persistence
const settingsFile = path.join(os.homedir(), '.manga-psd-merger-settings.json');
let appSettings = {
  layerNameRaw: 'RAW',
  layerNameClean: 'CLEAN',
  resizeMode: 'clean-to-raw',
  outputFolder: 'Output_PSDs'
};

if (fs.existsSync(settingsFile)) {
  try {
    appSettings = { ...appSettings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) };
  } catch (e) {
    console.error('Error loading settings:', e);
  }
}

app.get('/api/settings', (req, res) => {
  res.json(appSettings);
});

app.post('/api/settings', (req, res) => {
  appSettings = { ...appSettings, ...req.body };
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(appSettings, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving settings:', e);
  }
  res.json({ success: true });
});

// Helper to list Windows logical drives
function getWindowsDrives() {
  return new Promise((resolve) => {
    exec('wmic logicaldisk get name', (err, stdout) => {
      if (err) {
        // Fallback to basic drives if wmic fails
        return resolve(['C:\\']);
      }
      const drives = stdout
        .split('\r\n')
        .map(line => line.trim())
        .filter(line => /^[A-Z]:$/.test(line))
        .map(drive => drive + '\\');
      resolve(drives.length ? drives : ['C:\\']);
    });
  });
}

// API Directory Browser
app.get('/api/browse', async (req, res) => {
  let targetPath = req.query.path;
  
  try {
    if (!targetPath) {
      // Return drives list if no path specified
      const drives = await getWindowsDrives();
      return res.json({
        currentPath: '',
        parentPath: null,
        items: drives.map(drive => ({ name: drive, path: drive, isDirectory: true }))
      });
    }
    
    targetPath = path.resolve(targetPath);
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Folder does not exist' });
    }
    
    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a folder' });
    }
    
    const files = fs.readdirSync(targetPath, { withFileTypes: true });
    const items = files
      .filter(file => file.isDirectory() || !file.name.startsWith('.'))
      .map(file => ({
        name: file.name,
        path: path.join(targetPath, file.name),
        isDirectory: file.isDirectory()
      }))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
      
    res.json({
      currentPath: targetPath,
      parentPath: path.dirname(targetPath) === targetPath ? null : path.dirname(targetPath),
      items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Image extension patterns
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif', '.psd'];

function isImage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

// Check if a directory looks like a chapter (contains raw images and subfolders)
function scanChapterDirectory(dirPath) {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    // Collect potential RAW files from current folder
    const rawFiles = items
      .filter(item => item.isFile() && isImage(item.name) && !item.name.toLowerCase().includes('_clean'))
      .map(item => item.name);
      
    // Collect potential CLEAN subfolders
    const subfolders = items
      .filter(item => item.isDirectory())
      .map(item => item.name);
      
    return {
      rawCount: rawFiles.length,
      subfolders
    };
  } catch (e) {
    return { rawCount: 0, subfolders: [] };
  }
}

// API Scan Path (scans manga folder for chapters, or chapter folder directly)
app.get('/api/scan', (req, res) => {
  const targetPath = req.query.path;
  if (!targetPath || !fs.existsSync(targetPath)) {
    return res.status(400).json({ error: 'Valid directory path required' });
  }
  
  try {
    const items = fs.readdirSync(targetPath, { withFileTypes: true });
    
    // Option A: Direct chapter folder (contains raw images)
    const directScan = scanChapterDirectory(targetPath);
    if (directScan.rawCount > 0) {
      return res.json({
        type: 'chapter',
        path: targetPath,
        name: path.basename(targetPath),
        rawCount: directScan.rawCount,
        cleanFolders: directScan.subfolders
      });
    }
    
    // Option B: Manga root folder (contains chapter folders)
    const chapters = [];
    for (const item of items) {
      if (item.isDirectory()) {
        const fullPath = path.join(targetPath, item.name);
        const scan = scanChapterDirectory(fullPath);
        if (scan.rawCount > 0 || scan.subfolders.length > 0) {
          chapters.push({
            name: item.name,
            path: fullPath,
            rawCount: scan.rawCount,
            cleanFolders: scan.subfolders
          });
        }
      }
    }
    
    // Sort chapters numerically
    chapters.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    
    res.json({
      type: 'manga_root',
      path: targetPath,
      chapters
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Original matching logic ported to JS
function stripExt(name) {
  const idx = name.lastIndexOf('.');
  if (idx < 0) return name;
  return name.substring(0, idx);
}

function findCleanForRaw(rawName, cleanFiles, cleanFolderDir) {
  const base = stripExt(rawName);
  const baseLower = base.toLowerCase();
  
  // 1) Match base_clean.ext
  for (const f of cleanFiles) {
    const fBase = stripExt(f);
    if (fBase.toLowerCase() === baseLower + '_clean') {
      return path.join(cleanFolderDir, f);
    }
  }
  
  // 2) Match base.ext
  for (const f of cleanFiles) {
    const fBase = stripExt(f);
    if (fBase.toLowerCase() === baseLower) {
      return path.join(cleanFolderDir, f);
    }
  }
  
  // 3) Match flexible patterns
  for (const f of cleanFiles) {
    const stem = stripExt(f).toLowerCase();
    if (
      stem === baseLower ||
      stem === baseLower + '_clean' ||
      stem === baseLower + '-clean' ||
      stem === baseLower + ' clean' ||
      stem === baseLower + ' (clean)' ||
      stem.indexOf(baseLower + '_') === 0 ||
      stem.indexOf(baseLower + '-') === 0 ||
      stem.indexOf(baseLower + ' ') === 0 ||
      stem.indexOf(baseLower + '.') === 0
    ) {
      return path.join(cleanFolderDir, f);
    }
  }
  
  return null;
}

// Websockets Merge Engine
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.action === 'start-merge') {
        const { chapterPath, cleanSubfolder, settings } = data;
        
        ws.send(JSON.stringify({ type: 'log', message: `[START] Scanning ${path.basename(chapterPath)}...` }));
        
        const cleanFolderDir = path.join(chapterPath, cleanSubfolder);
        if (!fs.existsSync(cleanFolderDir)) {
          return ws.send(JSON.stringify({ type: 'error', message: `Clean folder ${cleanSubfolder} not found` }));
        }
        
        // Load files
        const items = fs.readdirSync(chapterPath, { withFileTypes: true });
        const rawFiles = items
          .filter(item => item.isFile() && isImage(item.name) && !item.name.toLowerCase().includes('_clean'))
          .map(item => item.name);
          
        const cleanFiles = fs.readdirSync(cleanFolderDir)
          .filter(f => isImage(f));
          
        ws.send(JSON.stringify({ type: 'log', message: `Found ${rawFiles.length} RAW files and ${cleanFiles.length} CLEAN files.` }));
        
        // Match files
        const matches = [];
        for (const raw of rawFiles) {
          const cleanPath = findCleanForRaw(raw, cleanFiles, cleanFolderDir);
          if (cleanPath) {
            matches.push({
              rawName: raw,
              rawPath: path.join(chapterPath, raw),
              cleanPath,
              outPath: path.join(chapterPath, settings.outputFolder || 'Output_PSDs', stripExt(raw) + '.psd')
            });
          } else {
            ws.send(JSON.stringify({ type: 'log', message: `[SKIP] No clean found for ${raw}` }));
          }
        }
        
        if (matches.length === 0) {
          ws.send(JSON.stringify({ type: 'log', message: `[DONE] No matching pages to merge.` }));
          return ws.send(JSON.stringify({ type: 'complete', processed: 0, skipped: rawFiles.length - matches.length }));
        }
        
        ws.send(JSON.stringify({ type: 'log', message: `Starting merge for ${matches.length} matched pages...` }));
        
        // Parallel Worker Setup
        const numCores = os.cpus().length;
        const numWorkers = Math.max(1, Math.min(numCores, Math.ceil(matches.length / 2)));
        ws.send(JSON.stringify({ type: 'log', message: `Allocating ${numWorkers} CPU worker threads...` }));
        
        let completed = 0;
        let successful = 0;
        let failed = 0;
        let matchIndex = 0;
        
        const startTime = Date.now();
        
        const runTask = (worker, workerId) => {
          if (matchIndex >= matches.length) {
            worker.terminate();
            return;
          }
          
          const taskIdx = matchIndex++;
          const task = matches[taskIdx];
          
          ws.send(JSON.stringify({ type: 'log', message: `[MERGING] Processing page ${task.rawName}...` }));
          
          worker.postMessage({
            rawPath: task.rawPath,
            cleanPath: task.cleanPath,
            outPath: task.outPath,
            layerNames: {
              raw: settings.layerNameRaw,
              clean: settings.layerNameClean
            },
            resizeMode: settings.resizeMode
          });
          
          worker.once('message', async (res) => {
            completed++;
            if (res.success) {
              successful++;
              let logMsg = `[OK] ${task.rawName} merged successfully.`;
              if (res.resized) logMsg += ` [Resized Clean]`;
              ws.send(JSON.stringify({ type: 'log', message: logMsg }));
              
              // Generate a live thumbnail of the raw file to display in the GUI
              try {
                const thumbBuffer = await sharp(task.rawPath)
                  .resize({ width: 250 })
                  .jpeg({ quality: 75 })
                  .toBuffer();
                ws.send(JSON.stringify({
                  type: 'preview',
                  pageName: task.rawName,
                  imageData: `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`
                }));
              } catch (e) {
                // Ignore preview errors
              }
            } else {
              failed++;
              ws.send(JSON.stringify({ type: 'log', message: `[ERROR] Failed to merge ${task.rawName}: ${res.error}` }));
            }
            
            // Send progress update
            ws.send(JSON.stringify({
              type: 'progress',
              completed,
              total: matches.length,
              percent: Math.round((completed / matches.length) * 100)
            }));
            
            if (completed === matches.length) {
              const duration = ((Date.now() - startTime) / 1000).toFixed(2);
              ws.send(JSON.stringify({ type: 'log', message: `[FINISHED] Successfully merged: ${successful}, Failed: ${failed}. Time: ${duration}s.` }));
              ws.send(JSON.stringify({ type: 'complete', processed: successful, failed, time: duration }));
            } else {
              // Run next task
              runTask(worker, workerId);
            }
          });
        };
        
        // Spawn workers
        // In pkg package mode, worker threads are spawned by reading the code and running it as an eval string
        const workerScriptPath = path.join(__dirname, 'worker.js');
        const workerCode = fs.readFileSync(workerScriptPath, 'utf8');
        
        for (let w = 0; w < numWorkers; w++) {
          try {
            const worker = new Worker(workerCode, { eval: true });
            runTask(worker, w);
          } catch (err) {
            ws.send(JSON.stringify({ type: 'log', message: `[ERROR] Failed to spawn worker thread: ${err.message}` }));
          }
        }
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: `Parse error: ${e.message}` }));
    }
  });
});

function launchAppWindow(url) {
  const { spawn } = require('child_process');
  
  if (process.platform === 'win32') {
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    
    // Check Chrome first
    for (const p of chromePaths) {
      if (fs.existsSync(p)) {
        const child = spawn(p, [`--app=${url}`], { detached: true, stdio: 'ignore' });
        child.unref();
        return;
      }
    }
    
    // Check Edge
    for (const p of edgePaths) {
      if (fs.existsSync(p)) {
        const child = spawn(p, [`--app=${url}`], { detached: true, stdio: 'ignore' });
        child.unref();
        return;
      }
    }
  }
  
  // Fallback to default browser
  open(url);
}

// Start HTTP Server
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  // Automatically open the user's browser in App Mode
  launchAppWindow(`http://localhost:${PORT}`);
});
