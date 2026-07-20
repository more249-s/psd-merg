// WebSocket connection reference
let ws = null;
let currentScanData = null;
let currentBrowsingPath = '';
let activeMergeTimer = null;
let mergeStartTime = 0;

// Settings cache
let appSettings = {
  layerNameRaw: 'RAW',
  layerNameClean: 'CLEAN',
  resizeMode: 'clean-to-raw',
  outputFolder: 'Output_PSDs'
};

// UI Elements
const el = {
  directoryPath: document.getElementById('directory-path'),
  btnBrowse: document.getElementById('btn-browse'),
  btnScan: document.getElementById('btn-scan'),
  
  chaptersActions: document.getElementById('chapters-actions'),
  btnSelectAll: document.getElementById('btn-select-all'),
  btnDeselectAll: document.getElementById('btn-deselect-all'),
  chaptersListWrapper: document.getElementById('chapters-list-wrapper'),
  chaptersEmptyState: document.getElementById('chapters-empty-state'),
  chaptersList: document.getElementById('chapters-list'),
  
  layerRaw: document.getElementById('layer-raw'),
  layerClean: document.getElementById('layer-clean'),
  resizeMode: document.getElementById('resize-mode'),
  outputFolder: document.getElementById('output-folder'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  
  progressCircle: document.getElementById('progress-circle'),
  progressPercentage: document.getElementById('progress-percentage'),
  statProcessed: document.getElementById('stat-processed'),
  statFailed: document.getElementById('stat-failed'),
  statTime: document.getElementById('stat-time'),
  currentTaskStatus: document.getElementById('current-task-status'),
  currentTaskCount: document.getElementById('current-task-count'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  btnStartMerge: document.getElementById('btn-start-merge'),
  
  previewPlaceholder: document.getElementById('preview-placeholder'),
  previewContent: document.getElementById('preview-content'),
  imgPreview: document.getElementById('img-preview'),
  previewBadgeName: document.getElementById('preview-badge-name'),
  
  logsConsole: document.getElementById('logs-console'),
  btnClearLogs: document.getElementById('btn-clear-logs'),
  
  // Modals
  browserModal: document.getElementById('browser-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  modalCurrentPath: document.getElementById('modal-current-path'),
  browserItemsList: document.getElementById('browser-items-list'),
  btnModalUp: document.getElementById('btn-modal-up'),
  btnModalSelect: document.getElementById('btn-modal-select'),
  
  cleanFolderModal: document.getElementById('clean-folder-modal'),
  cleanFolderOptionsContainer: document.getElementById('clean-folder-options-container')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
  initWebSocket();
});

// Load Settings from API
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const settings = await res.json();
    appSettings = { ...appSettings, ...settings };
    
    el.layerRaw.value = appSettings.layerNameRaw;
    el.layerClean.value = appSettings.layerNameClean;
    el.resizeMode.value = appSettings.resizeMode;
    el.outputFolder.value = appSettings.outputFolder;
  } catch (e) {
    appendLog('system', `[SYSTEM] فشل تحميل الإعدادات الافتراضية: ${e.message}`);
  }
}

// Save Settings to API
async function saveSettings() {
  const newSettings = {
    layerNameRaw: el.layerRaw.value.trim() || 'RAW',
    layerNameClean: el.layerClean.value.trim() || 'CLEAN',
    resizeMode: el.resizeMode.value,
    outputFolder: el.outputFolder.value.trim() || 'Output_PSDs'
  };
  
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    
    if (res.ok) {
      appSettings = newSettings;
      appendLog('success', `[SYSTEM] تم حفظ الإعدادات بنجاح.`);
      alert('تم حفظ الإعدادات بنجاح!');
    }
  } catch (e) {
    appendLog('error', `[SYSTEM] فشل حفظ الإعدادات: ${e.message}`);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  el.btnScan.addEventListener('click', scanDirectory);
  el.btnSaveSettings.addEventListener('click', saveSettings);
  el.btnClearLogs.addEventListener('click', () => el.logsConsole.innerHTML = '');
  
  el.btnSelectAll.addEventListener('click', () => toggleAllChapters(true));
  el.btnDeselectAll.addEventListener('click', () => toggleAllChapters(false));
  
  // Start merge action
  el.btnStartMerge.addEventListener('click', startMergeProcess);
  
  // Folder browser triggers
  el.btnBrowse.addEventListener('click', () => openFileBrowser(''));
  el.btnCloseModal.addEventListener('click', () => el.browserModal.style.display = 'none');
  el.btnModalUp.addEventListener('click', navigateBrowserUp);
  el.btnModalSelect.addEventListener('click', selectBrowsingPath);
}

// WebSocket connection management
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    appendLog('system', '[SYSTEM] تم الاتصال بالخادم بنجاح.');
  };
  
  ws.onclose = () => {
    appendLog('error', '[SYSTEM] انقطع الاتصال بالخادم. جاري إعادة المحاولة خلال 3 ثوانٍ...');
    setTimeout(initWebSocket, 3000);
  };
  
  ws.onerror = (err) => {
    console.error('WS Error:', err);
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'log':
        let logClass = 'info';
        if (data.message.includes('[OK]')) logClass = 'success';
        if (data.message.includes('[ERROR]')) logClass = 'error';
        if (data.message.includes('[SKIP]')) logClass = 'skip';
        if (data.message.includes('[START]') || data.message.includes('[FINISHED]')) logClass = 'system';
        appendLog(logClass, data.message);
        break;
        
      case 'progress':
        updateProgressBar(data.percent, data.completed, data.total);
        break;
        
      case 'preview':
        showLivePreview(data.pageName, data.imageData);
        break;
        
      case 'complete':
        finalizeMerge(data);
        break;
        
      case 'error':
        appendLog('error', `[ERROR] ${data.message}`);
        break;
    }
  };
}

// Write to scrolling logs console
function appendLog(type, message) {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.textContent = message;
  el.logsConsole.appendChild(line);
  el.logsConsole.scrollTop = el.logsConsole.scrollHeight;
}

// Directory scanning logic
async function scanDirectory() {
  const pathVal = el.directoryPath.value.trim();
  if (!pathVal) {
    return alert('الرجاء إدخال أو تصفح مسار المجلد أولاً.');
  }
  
  el.btnScan.disabled = true;
  el.btnScan.textContent = 'جاري الفحص...';
  
  try {
    const res = await fetch(`/api/scan?path=${encodeURIComponent(pathVal)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'فشل فحص المجلد');
    }
    
    const data = await res.json();
    currentScanData = data;
    renderScanResults(data);
  } catch (e) {
    appendLog('error', `[SYSTEM] فشل الفحص: ${e.message}`);
    alert(`حدث خطأ أثناء الفحص: ${e.message}`);
  } finally {
    el.btnScan.disabled = false;
    el.btnScan.textContent = 'فحص المجلد ⚡';
  }
}

// Render chapters scan list in UI
function renderScanResults(data) {
  el.chaptersList.innerHTML = '';
  
  if (data.type === 'chapter') {
    // Single chapter scanned
    el.chaptersActions.style.display = 'none';
    el.chaptersEmptyState.style.display = 'none';
    el.chaptersList.style.display = 'flex';
    
    const row = document.createElement('div');
    row.className = 'chapter-row';
    row.innerHTML = `
      <div class="chapter-info">
        <span class="chapter-name">${data.name}</span>
        <span class="chapter-badge">صفحة: ${data.rawCount}</span>
      </div>
      <div class="chapter-checkbox-container">
        <input type="checkbox" class="chapter-checkbox" data-path="${data.path}" checked disabled>
      </div>
    `;
    el.chaptersList.appendChild(row);
    appendLog('system', `[SYSTEM] تم الكشف عن مجلد فصل مباشر: ${data.name} ويحتوي على ${data.rawCount} صفحة.`);
    
    el.btnStartMerge.disabled = false;
  } else if (data.type === 'manga_root') {
    // Manga root folder with multiple chapters scanned
    if (data.chapters.length === 0) {
      el.chaptersEmptyState.style.display = 'flex';
      el.chaptersList.style.display = 'none';
      el.chaptersActions.style.display = 'none';
      el.btnStartMerge.disabled = true;
      appendLog('skip', `[SYSTEM] لم يتم العثور على أي فصول صالحة تحتوي على صور RAW.`);
      return;
    }
    
    el.chaptersActions.style.display = 'flex';
    el.chaptersEmptyState.style.display = 'none';
    el.chaptersList.style.display = 'flex';
    
    data.chapters.forEach(ch => {
      const row = document.createElement('div');
      row.className = 'chapter-row';
      row.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = row.querySelector('.chapter-checkbox');
          cb.checked = !cb.checked;
          updateMergeButtonState();
        }
      });
      
      row.innerHTML = `
        <div class="chapter-info">
          <span class="chapter-name">${ch.name}</span>
          <span class="chapter-badge">صفحة: ${ch.rawCount}</span>
        </div>
        <div class="chapter-checkbox-container">
          <input type="checkbox" class="chapter-checkbox" data-path="${ch.path}" checked>
        </div>
      `;
      // Listen to check state change
      row.querySelector('.chapter-checkbox').addEventListener('change', updateMergeButtonState);
      
      el.chaptersList.appendChild(row);
    });
    
    appendLog('system', `[SYSTEM] تم الكشف عن ${data.chapters.length} فصلاً في المجلد الرئيسي.`);
    updateMergeButtonState();
  }
}

function toggleAllChapters(checked) {
  document.querySelectorAll('.chapter-checkbox').forEach(cb => {
    cb.checked = checked;
  });
  updateMergeButtonState();
}

function updateMergeButtonState() {
  const checkedCount = document.querySelectorAll('.chapter-checkbox:checked').length;
  el.btnStartMerge.disabled = checkedCount === 0;
}

// UI Progress ring & bars update
function updateProgressBar(percent, completed, total) {
  // Update linear progress bar
  el.progressBarFill.style.width = `${percent}%`;
  el.currentTaskCount.textContent = `${completed} / ${total}`;
  el.progressPercentage.textContent = `${percent}%`;
  
  // Update circular ring offset (Circumference is 326.7)
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  el.progressCircle.style.strokeDashoffset = offset;
}

// Render dynamic image preview
function showLivePreview(name, base64Data) {
  el.previewPlaceholder.style.display = 'none';
  el.previewContent.style.display = 'block';
  el.imgPreview.src = base64Data;
  el.previewBadgeName.textContent = `جاري معالجة: ${name}`;
}

// Browse Modal filesystem navigator
async function openFileBrowser(pathVal) {
  el.browserModal.style.display = 'flex';
  el.browserItemsList.innerHTML = '<div class="empty-state"><p>جاري تحميل المجلدات...</p></div>';
  el.modalCurrentPath.textContent = pathVal || 'جذور النظام';
  
  try {
    const res = await fetch(`/api/browse?path=${encodeURIComponent(pathVal)}`);
    const data = await res.json();
    currentBrowsingPath = data.currentPath;
    el.modalCurrentPath.textContent = data.currentPath || 'جذور النظام';
    
    el.browserItemsList.innerHTML = '';
    
    if (data.items.length === 0) {
      el.browserItemsList.innerHTML = '<div class="empty-state"><p>هذا المجلد فارغ.</p></div>';
      return;
    }
    
    data.items.forEach(item => {
      // Only browse directories
      if (!item.isDirectory) return;
      
      const elItem = document.createElement('div');
      elItem.className = 'browser-item';
      elItem.innerHTML = `
        <span class="browser-item-icon">📁</span>
        <span class="browser-item-name" title="${item.name}">${item.name}</span>
      `;
      
      elItem.addEventListener('click', () => {
        document.querySelectorAll('.browser-item').forEach(i => i.classList.remove('active'));
        elItem.classList.add('active');
        currentBrowsingPath = item.path;
      });
      
      elItem.addEventListener('dblclick', () => {
        openFileBrowser(item.path);
      });
      
      el.browserItemsList.appendChild(elItem);
    });
    
    // Manage parent path btn state
    el.btnModalUp.disabled = !data.parentPath;
    el.btnModalUp.onclick = () => {
      if (data.parentPath) openFileBrowser(data.parentPath);
    };
  } catch (e) {
    el.browserItemsList.innerHTML = `<div class="empty-state"><p class="danger">حدث خطأ: ${e.message}</p></div>`;
  }
}

function navigateBrowserUp() {
  // Overridden dynamically inside openFileBrowser
}

function selectBrowsingPath() {
  if (currentBrowsingPath) {
    el.directoryPath.value = currentBrowsingPath;
    el.browserModal.style.display = 'none';
    scanDirectory();
  }
}

// Merge Loop Coordination
let queue = [];
let activeIndex = 0;
let totalProcessedCount = 0;
let totalFailedCount = 0;

async function startMergeProcess() {
  const selectedCheckboxes = document.querySelectorAll('.chapter-checkbox:checked');
  if (selectedCheckboxes.length === 0) return;
  
  // Set UI state
  el.btnStartMerge.disabled = true;
  el.btnScan.disabled = true;
  el.btnBrowse.disabled = true;
  el.directoryPath.disabled = true;
  
  // Initialize Stats
  totalProcessedCount = 0;
  totalFailedCount = 0;
  el.statProcessed.textContent = '0';
  el.statFailed.textContent = '0';
  
  updateProgressBar(0, 0, 0);
  
  queue = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-path'));
  activeIndex = 0;
  
  // Save settings first
  appSettings = {
    layerNameRaw: el.layerRaw.value.trim() || 'RAW',
    layerNameClean: el.layerClean.value.trim() || 'CLEAN',
    resizeMode: el.resizeMode.value,
    outputFolder: el.outputFolder.value.trim() || 'Output_PSDs'
  };
  
  // Start Timer
  mergeStartTime = Date.now();
  if (activeMergeTimer) clearInterval(activeMergeTimer);
  activeMergeTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - mergeStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    el.statTime.textContent = `${m}:${s}`;
  }, 1000);
  
  processNextInQueue();
}

async function processNextInQueue() {
  if (activeIndex >= queue.length) {
    // Queue finished
    clearInterval(activeMergeTimer);
    el.btnScan.disabled = false;
    el.btnBrowse.disabled = false;
    el.directoryPath.disabled = false;
    el.currentTaskStatus.textContent = 'اكتملت جميع العمليات!';
    appendLog('success', `[SYSTEM] انتهى دمج كافة الفصول المحددة بنجاح.`);
    alert('انتهت معالجة كافة الفصول المحددة!');
    return;
  }
  
  const chapterPath = queue[activeIndex];
  const chapterName = pathBasename(chapterPath);
  
  el.currentTaskStatus.textContent = `فصل: ${chapterName} - جاري التحليل...`;
  
  // Find clean subfolder
  let cleanSubfolder = '';
  
  try {
    const res = await fetch(`/api/scan?path=${encodeURIComponent(chapterPath)}`);
    const data = await res.json();
    
    const subfolders = data.cleanFolders || [];
    
    if (subfolders.length === 0) {
      appendLog('error', `[SKIP] لا يحتوي الفصل ${chapterName} على مجلدات فرعية لصفحات التبييض (clean).`);
      activeIndex++;
      processNextInQueue();
      return;
    }
    
    // Choose clean folder
    if (subfolders.length === 1) {
      cleanSubfolder = subfolders[0];
      executeChapterMerge(chapterPath, cleanSubfolder);
    } else {
      // Multiple folders found, ask the user
      promptCleanFolderSelect(subfolders, (selectedFolder) => {
        executeChapterMerge(chapterPath, selectedFolder);
      });
    }
  } catch (e) {
    appendLog('error', `[ERROR] فشل فحص الفصل ${chapterName}: ${e.message}`);
    activeIndex++;
    processNextInQueue();
  }
}

function promptCleanFolderSelect(folders, callback) {
  el.cleanFolderModal.style.display = 'flex';
  el.cleanFolderOptionsContainer.innerHTML = '';
  
  folders.forEach(folder => {
    const btn = document.createElement('button');
    btn.className = 'clean-folder-btn';
    btn.innerHTML = `<span>${folder}</span>`;
    btn.addEventListener('click', () => {
      el.cleanFolderModal.style.display = 'none';
      callback(folder);
    });
    el.cleanFolderOptionsContainer.appendChild(btn);
  });
}

function executeChapterMerge(chapterPath, cleanSubfolder) {
  const chapterName = pathBasename(chapterPath);
  el.currentTaskStatus.textContent = `فصل: ${chapterName} - جاري الدمج مع [${cleanSubfolder}]...`;
  
  ws.send(JSON.stringify({
    action: 'start-merge',
    chapterPath,
    cleanSubfolder,
    settings: appSettings
  }));
}

function finalizeMerge(data) {
  totalProcessedCount += data.processed || 0;
  totalFailedCount += data.failed || 0;
  
  el.statProcessed.textContent = totalProcessedCount;
  el.statFailed.textContent = totalFailedCount;
  
  // Process next chapter
  activeIndex++;
  processNextInQueue();
}

// Utility to get base filename from path
function pathBasename(filePath) {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath;
}
