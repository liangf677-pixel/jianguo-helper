/**
 * 坚果 - Electron 主进程
 * 负责窗口管理、系统托盘、全局快捷键、IPC通信、通知调度等
 * @version 1.0.1
 */
const {
  app, BrowserWindow, Tray, Menu, ipcMain, Notification,
  globalShortcut, nativeImage, dialog, shell
} = require('electron');
const path = require('path');
const fs = require('fs');

// ===== 单实例运行机制（最高优先级） =====
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // 已有实例在运行，退出当前实例
  app.quit();
} else {
  // 当用户尝试启动第二个实例时，激活已有实例的主窗口
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // ===== 配置常量 =====
  const CONFIG = {
    APP_NAME: '坚果',
    WIN_WIDTH: 1280,
    WIN_HEIGHT: 800,
    MIN_WIDTH: 900,
    MIN_HEIGHT: 600
  };

  // ===== 全局状态 =====
  let mainWindow = null;
  let tray = null;
  let isQuitting = false;
  let alarmTimers = new Map();
  let reminderTimers = new Map();
  let overdueCheckInterval = null;

  // ===== 数据存储（便携模式：数据保存在 exe 旁边的 "坚果数据" 目录） =====
  const Store = require('electron-store');
  // portable 模式下，PORTABLE_EXECUTABLE_DIR 指向 exe 所在的原目录
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
    || (app.isPackaged ? path.dirname(app.getPath('exe')) : null);
  const dataDir = portableDir
    ? path.join(portableDir, '坚果数据')
    : path.join(__dirname, '坚果数据');
  const store = new Store({
    cwd: dataDir,
    defaults: {
      windowBounds: { width: CONFIG.WIN_WIDTH, height: CONFIG.WIN_HEIGHT, x: undefined, y: undefined },
      windowMaximized: false,
      tasks: [],
      alarms: [],
      timers: [],
      notes: [],
      anniversaries: [],
      settings: {
        theme: 'light',
        accentColor: '#3b82f6',
        fontSize: 'medium',
        timeFormat: '24h',
        showLunar: false,
        notifications: true,
        notificationVolume: 80,
        notificationDuration: 5000,
        autoStart: false,
        minimizeToTray: true,
        autoSaveInterval: 30000,
        globalShortcutOpen: 'Ctrl+Shift+T',
        globalShortcutNewTask: 'Ctrl+Shift+N',
        weatherEnabled: true,
        weatherLat: 31.46,
        weatherLon: 104.68,
        weatherCity: '绵阳',
        weatherUpdateInterval: 30
      }
    }
  });

  // ===== 生成托盘图标（PNG格式，确保可靠显示） =====
  function createTrayIcon() {
    const iconPath = path.join(__dirname, 'assets', 'icons', 'icon.ico');
    const pngPath = path.join(__dirname, 'assets', 'icons', 'icon.png');
    const trayPngPath = path.join(__dirname, 'assets', 'icons', 'tray-icon.png');

    // 尝试加载 ICO 文件
    if (fs.existsSync(iconPath)) {
      try {
        return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
      } catch (e) { /* 失败则继续尝试 */ }
    }

    // 尝试加载 PNG 文件
    if (fs.existsSync(trayPngPath)) {
      try {
        return nativeImage.createFromPath(trayPngPath).resize({ width: 16, height: 16 });
      } catch (e) { /* 失败则继续尝试 */ }
    }
    if (fs.existsSync(pngPath)) {
      try {
        return nativeImage.createFromPath(pngPath).resize({ width: 16, height: 16 });
      } catch (e) { /* 失败则继续尝试 */ }
    }

    // 回退：用原生方法创建纯色图标（蓝紫色方块）
    // 通过创建一个简单的图像缓冲区来避免依赖外部文件
    const size = 32;
    const buf = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      const cx = size / 2, cy = size / 2;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const offset = i * 4;
      if (dist < size / 2 - 1) {
        // 蓝紫色渐变圆角
        buf[offset] = 246;     // B
        buf[offset + 1] = 110; // G
        buf[offset + 2] = 59;  // R
        buf[offset + 3] = 255; // A
      } else {
        buf[offset] = 0;
        buf[offset + 1] = 0;
        buf[offset + 2] = 0;
        buf[offset + 3] = 0;
      }
    }
    const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
    return img.resize({ width: 16, height: 16 });
  }

  // ===== 创建主窗口 =====
  function createWindow() {
    const bounds = store.get('windowBounds');
    const maximized = store.get('windowMaximized');

    // 确保窗口在可见屏幕范围内
    let winX = bounds.x, winY = bounds.y;
    if (winX !== undefined && winY !== undefined) {
      // 简单验证坐标有效性
      if (winX < -1000 || winY < -1000) { winX = undefined; winY = undefined; }
    }

    mainWindow = new BrowserWindow({
      width: bounds.width || CONFIG.WIN_WIDTH,
      height: bounds.height || CONFIG.WIN_HEIGHT,
      x: winX,
      y: winY,
      minWidth: CONFIG.MIN_WIDTH,
      minHeight: CONFIG.MIN_HEIGHT,
      title: CONFIG.APP_NAME,
      icon: path.join(__dirname, 'assets', 'icons', 'icon.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      },
      show: false,
      autoHideMenuBar: true,
      resizable: true,
      maximizable: true,
      minimizable: true,
      fullscreenable: true
    });

    if (maximized) {
      mainWindow.maximize();
    }

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // 关闭窗口时隐藏到托盘（而不是退出）
    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
        // 更新托盘提示
        if (tray) {
          updateTrayTooltip();
        }
        return false;
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // 窗口状态记忆（防抖处理）
    let saveBoundsTimer = null;
    const saveBounds = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      clearTimeout(saveBoundsTimer);
      saveBoundsTimer = setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const isMax = mainWindow.isMaximized();
        store.set('windowMaximized', isMax);
        if (!isMax) {
          const b = mainWindow.getBounds();
          store.set('windowBounds', { width: b.width, height: b.height, x: b.x, y: b.y });
        }
      }, 500);
    };

    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);
    mainWindow.on('maximize', () => store.set('windowMaximized', true));
    mainWindow.on('unmaximize', () => store.set('windowMaximized', false));

    // 窗口显示/隐藏时更新托盘提示
    mainWindow.on('show', () => updateTrayTooltip());
    mainWindow.on('hide', () => updateTrayTooltip());
  }

  // ===== 系统托盘 =====
  function createTray() {
    const trayIcon = createTrayIcon();
    tray = new Tray(trayIcon);
    tray.setToolTip(CONFIG.APP_NAME);
    updateTrayContextMenu();

    // 左键点击：切换显示/隐藏主窗口
    tray.on('click', () => {
      if (!mainWindow) {
        createWindow();
        return;
      }
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  function updateTrayTooltip() {
    if (!tray) return;
    const taskCount = store.get('tasks', []).filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    tray.setToolTip(`${CONFIG.APP_NAME}\n待完成任务：${taskCount} 个`);
  }

  function updateTrayContextMenu() {
    if (!tray) return;
    const todayTasks = getTodayTasks();
    const overdueTasks = getOverdueTasks();
    const pendingTasks = store.get('tasks', []).filter(t => t.status === 'pending' || t.status === 'in_progress');

    const menu = Menu.buildFromTemplate([
      {
        label: '打开主窗口',
        click: () => {
          if (!mainWindow) { createWindow(); return; }
          mainWindow.show();
          mainWindow.focus();
        }
      },
      {
        label: `今日任务（${todayTasks.length}）`,
        enabled: todayTasks.length > 0,
        click: () => showMainAndSend('navigate', 'tasks-today')
      },
      {
        label: `逾期任务（${overdueTasks.length}）`,
        enabled: overdueTasks.length > 0,
        click: () => showMainAndSend('navigate', 'tasks-overdue')
      },
      { type: 'separator' },
      {
        label: '新建任务',
        click: () => showMainAndSend('open-new-task')
      },
      {
        label: `待完成任务：${pendingTasks.length} 个`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: '退出应用',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(menu);
  }

  function showMainAndSend(channel, data) {
    if (!mainWindow) { createWindow(); }
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      // 稍微延迟确保渲染进程准备好
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(channel, data);
        }
      }, 100);
    }
  }

  function getTodayTasks() {
    const tasks = store.get('tasks') || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= today && due < tomorrow;
    });
  }

  function getOverdueTasks() {
    const tasks = store.get('tasks') || [];
    const now = new Date();
    return tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now;
    });
  }

  // ===== 全局快捷键 =====
  function registerShortcuts() {
    const settings = store.get('settings');
    try {
      const openShortcut = settings.globalShortcutOpen || 'Ctrl+Shift+T';
      const newTaskShortcut = settings.globalShortcutNewTask || 'Ctrl+Shift+N';

      globalShortcut.register(openShortcut, () => {
        if (!mainWindow) { createWindow(); return; }
        mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
      });

      globalShortcut.register(newTaskShortcut, () => {
        showMainAndSend('open-new-task');
      });
    } catch (e) {
      console.error('注册全局快捷键失败:', e.message);
    }
  }

  // ===== 开机自启 =====
  function setAutoStart(enable) {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath('exe'),
      args: ['--minimized']
    });
  }

  // ===== IPC 处理器 =====
  function setupIPC() {
    // ---- 任务操作 ----
    ipcMain.handle('get-tasks', () => store.get('tasks'));
    ipcMain.handle('save-tasks', (_, tasks) => {
      store.set('tasks', tasks);
      scheduleAllReminders();
      updateTrayTooltip();
      updateTrayContextMenu();
      return true;
    });

    ipcMain.handle('add-task', (_, task) => {
      const tasks = store.get('tasks');
      task.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      task.createdAt = new Date().toISOString();
      task.status = task.status || 'pending';
      tasks.push(task);
      store.set('tasks', tasks);
      scheduleTaskReminder(task);
      updateTrayTooltip();
      updateTrayContextMenu();
      return task;
    });

    ipcMain.handle('update-task', (_, updatedTask) => {
      const tasks = store.get('tasks');
      const idx = tasks.findIndex(t => t.id === updatedTask.id);
      if (idx !== -1) {
        tasks[idx] = { ...tasks[idx], ...updatedTask, updatedAt: new Date().toISOString() };
        store.set('tasks', tasks);
        scheduleAllReminders();
        updateTrayTooltip();
        updateTrayContextMenu();
        return tasks[idx];
      }
      return null;
    });

    ipcMain.handle('delete-task', (_, taskId) => {
      let tasks = store.get('tasks');
      tasks = tasks.filter(t => t.id !== taskId);
      store.set('tasks', tasks);
      cancelTaskReminder(taskId);
      updateTrayTooltip();
      updateTrayContextMenu();
      return true;
    });

    ipcMain.handle('batch-update-tasks', (_, { taskIds, updates }) => {
      let tasks = store.get('tasks');
      tasks = tasks.map(t => {
        if (taskIds.includes(t.id)) {
          return { ...t, ...updates, updatedAt: new Date().toISOString() };
        }
        return t;
      });
      store.set('tasks', tasks);
      scheduleAllReminders();
      updateTrayTooltip();
      updateTrayContextMenu();
      return true;
    });

    ipcMain.handle('batch-delete-tasks', (_, taskIds) => {
      let tasks = store.get('tasks');
      tasks = tasks.filter(t => !taskIds.includes(t.id));
      store.set('tasks', tasks);
      taskIds.forEach(id => cancelTaskReminder(id));
      updateTrayTooltip();
      updateTrayContextMenu();
      return true;
    });

    // ---- 闹钟操作 ----
    ipcMain.handle('get-alarms', () => store.get('alarms'));
    ipcMain.handle('save-alarms', (_, alarms) => {
      store.set('alarms', alarms);
      scheduleAllAlarms();
      return true;
    });

    // ---- 便签操作 ----
    ipcMain.handle('get-notes', () => store.get('notes'));
    ipcMain.handle('save-notes', (_, notes) => {
      store.set('notes', notes);
      return true;
    });

    // ---- 纪念日操作 ----
    ipcMain.handle('get-anniversaries', () => store.get('anniversaries'));
    ipcMain.handle('save-anniversaries', (_, anniversaries) => {
      store.set('anniversaries', anniversaries);
      scheduleAnniversaryReminders();
      return true;
    });

    // ---- 设置操作 ----
    ipcMain.handle('get-settings', () => store.get('settings'));
    ipcMain.handle('save-settings', (_, settings) => {
      const oldSettings = store.get('settings');
      store.set('settings', settings);

      if (oldSettings.globalShortcutOpen !== settings.globalShortcutOpen ||
          oldSettings.globalShortcutNewTask !== settings.globalShortcutNewTask) {
        globalShortcut.unregisterAll();
        registerShortcuts();
      }
      if (oldSettings.autoStart !== settings.autoStart) {
        setAutoStart(settings.autoStart);
      }
      return true;
    });

    // ---- 数据备份与恢复 ----
    ipcMain.handle('export-data', async () => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出数据',
        defaultPath: `坚果-备份-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON 文件', extensions: ['json'] }]
      });
      if (result.canceled) return { success: false, reason: 'cancelled' };
      const data = {
        version: '1.0.1',
        exportedAt: new Date().toISOString(),
        tasks: store.get('tasks'),
        alarms: store.get('alarms'),
        timers: store.get('timers'),
        notes: store.get('notes'),
        anniversaries: store.get('anniversaries'),
        settings: store.get('settings')
      };
      try {
        fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
        return { success: true, path: result.filePath };
      } catch (err) {
        return { success: false, reason: err.message };
      }
    });

    ipcMain.handle('import-data', async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: '导入数据',
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
        properties: ['openFile']
      });
      if (result.canceled) return { success: false, reason: 'cancelled' };
      try {
        const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
        const data = JSON.parse(raw);
        if (data.version) {
          if (data.tasks) store.set('tasks', data.tasks);
          if (data.alarms) store.set('alarms', data.alarms);
          if (data.timers) store.set('timers', data.timers);
          if (data.notes) store.set('notes', data.notes);
          if (data.anniversaries) store.set('anniversaries', data.anniversaries);
          if (data.settings) store.set('settings', data.settings);
          scheduleAllReminders();
          scheduleAllAlarms();
          scheduleAnniversaryReminders();
          updateTrayTooltip();
          updateTrayContextMenu();
          return { success: true };
        }
        return { success: false, reason: '无效的备份文件格式' };
      } catch (err) {
        return { success: false, reason: err.message };
      }
    });

    ipcMain.handle('clear-all-data', async () => {
      store.set('tasks', []);
      store.set('alarms', []);
      store.set('timers', []);
      store.set('notes', []);
      store.set('anniversaries', []);
      updateTrayTooltip();
      updateTrayContextMenu();
      return true;
    });

    ipcMain.handle('show-confirm-dialog', async (_, options) => {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['取消', '确认'],
        defaultId: 0,
        title: options.title || '确认',
        message: options.message || '你确定吗？',
        detail: options.detail || ''
      });
      return result.response === 1;
    });

    ipcMain.handle('get-storage-info', () => {
      const userDataPath = app.getPath('userData');
      let totalSize = 0;
      try {
        const files = fs.readdirSync(userDataPath);
        files.forEach(f => {
          const fp = path.join(userDataPath, f);
          if (fs.statSync(fp).isFile()) totalSize += fs.statSync(fp).size;
        });
      } catch (e) { /* 忽略 */ }
      return {
        path: userDataPath,
        size: (totalSize / 1024).toFixed(1) + ' KB',
        taskCount: store.get('tasks').length,
        noteCount: store.get('notes').length,
        alarmCount: store.get('alarms').length
      };
    });

    ipcMain.handle('open-external', (_, url) => {
      if (url.startsWith('http')) shell.openExternal(url);
      return true;
    });
  }

  // ===== 系统通知 =====
  function showSystemNotification(title, body) {
    if (!store.get('settings.notifications')) return;
    try {
      const n = new Notification({
        title: title,
        body: body,
        icon: path.join(__dirname, 'assets', 'icons', 'icon.png'),
        silent: false
      });
      n.on('click', () => {
        if (!mainWindow) createWindow();
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      });
      n.show();
    } catch (e) { /* 通知失败不影响主流程 */ }
  }

  // ===== 任务提醒调度 =====
  function scheduleTaskReminder(task) {
    cancelTaskReminder(task.id);
    if (task.status === 'completed' || task.status === 'cancelled') return;
    if (!task.dueDate) return;

    let reminderDate;
    if (task.reminderTime) {
      reminderDate = new Date(task.reminderTime);
    } else if (task.reminderBefore) {
      reminderDate = new Date(task.dueDate);
      const before = task.reminderBefore;
      if (before === '15min') reminderDate.setMinutes(reminderDate.getMinutes() - 15);
      else if (before === '30min') reminderDate.setMinutes(reminderDate.getMinutes() - 30);
      else if (before === '1hour') reminderDate.setHours(reminderDate.getHours() - 1);
      else if (before === '2hour') reminderDate.setHours(reminderDate.getHours() - 2);
      else if (before === '1day') reminderDate.setDate(reminderDate.getDate() - 1);
      else if (before === '1week') reminderDate.setDate(reminderDate.getDate() - 7);
      else reminderDate.setMinutes(reminderDate.getMinutes() - 15);
    }

    if (reminderDate && reminderDate > new Date()) {
      const delay = reminderDate.getTime() - Date.now();
      const timer = setTimeout(() => {
        showSystemNotification('任务提醒', `${task.title}${task.dueDate ? ' - 截止: ' + new Date(task.dueDate).toLocaleString('zh-CN') : ''}`);
        if (task.repeatCycle && task.repeatCycle !== 'none') {
          rescheduleRecurringTask(task);
        }
        reminderTimers.delete(task.id);
      }, delay);
      reminderTimers.set(task.id, timer);
    }
  }

  function cancelTaskReminder(taskId) {
    if (reminderTimers.has(taskId)) {
      clearTimeout(reminderTimers.get(taskId));
      reminderTimers.delete(taskId);
    }
  }

  function rescheduleRecurringTask(task) {
    if (!task.repeatCycle || task.repeatCycle === 'none') return;
    const tasks = store.get('tasks');
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx === -1) return;
    const newDueDate = new Date(task.dueDate);
    if (task.repeatCycle === 'daily') newDueDate.setDate(newDueDate.getDate() + 1);
    else if (task.repeatCycle === 'weekly') newDueDate.setDate(newDueDate.getDate() + 7);
    else if (task.repeatCycle === 'monthly') newDueDate.setMonth(newDueDate.getMonth() + 1);
    else if (task.repeatCycle === 'yearly') newDueDate.setFullYear(newDueDate.getFullYear() + 1);
    tasks[idx].dueDate = newDueDate.toISOString();
    tasks[idx].status = 'pending';
    store.set('tasks', tasks);
    scheduleTaskReminder(tasks[idx]);
  }

  function scheduleAllReminders() {
    reminderTimers.forEach((timer) => clearTimeout(timer));
    reminderTimers.clear();
    const tasks = store.get('tasks');
    tasks.forEach(task => scheduleTaskReminder(task));
  }

  // ===== 逾期任务检查 =====
  function startOverdueCheck() {
    if (overdueCheckInterval) clearInterval(overdueCheckInterval);
    overdueCheckInterval = setInterval(() => {
      const overdueTasks = getOverdueTasks();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('overdue-update', overdueTasks.length);
      }
      // 每小时提醒一次逾期任务
      if (overdueTasks.length > 0) {
        showSystemNotification('逾期任务提醒', `你有 ${overdueTasks.length} 个逾期任务未完成`);
      }
    }, 3600000);
  }

  // ===== 闹钟调度 =====
  function scheduleAllAlarms() {
    alarmTimers.forEach((timer) => clearTimeout(timer));
    alarmTimers.clear();
    const alarms = store.get('alarms');
    alarms.forEach(alarm => {
      if (alarm.enabled) scheduleAlarm(alarm);
    });
  }

  function scheduleAlarm(alarm) {
    if (!alarm.enabled) return;
    const now = new Date();
    const [h, m] = (alarm.time || '00:00').split(':').map(Number);
    const alarmTime = new Date();
    alarmTime.setHours(h, m, 0, 0);
    if (alarmTime <= now) alarmTime.setDate(alarmTime.getDate() + 1);

    if (alarm.repeatDays && alarm.repeatDays.length > 0) {
      const dayMap = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
      let found = false;
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + i);
        const dayName = dayMap[checkDate.getDay()];
        if (alarm.repeatDays.includes(dayName)) {
          const checkAlarm = new Date(checkDate);
          checkAlarm.setHours(h, m, 0, 0);
          if (checkAlarm > now) {
            alarmTime.setTime(checkAlarm.getTime());
            found = true;
            break;
          }
        }
      }
      if (!found) return;
    }

    const delay = alarmTime.getTime() - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(() => triggerAlarm(alarm), delay);
    alarmTimers.set(alarm.id, timer);
  }

  function triggerAlarm(alarm) {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('alarm-triggered', alarm);
    } else {
      createWindow();
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('alarm-triggered', alarm);
        }
      }, 1000);
    }
    showSystemNotification('闹钟提醒', alarm.name || '闹钟时间到了！');

    if (alarm.repeatDays && alarm.repeatDays.length > 0) {
      scheduleAlarm(alarm);
    } else {
      const alarms = store.get('alarms');
      const idx = alarms.findIndex(a => a.id === alarm.id);
      if (idx !== -1) {
        alarms[idx].enabled = false;
        store.set('alarms', alarms);
      }
    }
  }

  // ===== 纪念日提醒 =====
  function scheduleAnniversaryReminders() {
    const anniversaries = store.get('anniversaries');
    anniversaries.forEach(ann => {
      if (ann.remindBefore === undefined) return;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const annDate = new Date(ann.date);
      annDate.setFullYear(today.getFullYear());
      if (annDate < today) annDate.setFullYear(today.getFullYear() + 1);
      const diffDays = Math.ceil((annDate - today) / (1000 * 60 * 60 * 24));
      const remindDays = parseInt(ann.remindBefore) || 0;
      if (diffDays <= remindDays && diffDays >= 0) {
        showSystemNotification('纪念日提醒', `${ann.name} - 还有 ${diffDays} 天`);
      }
    });
  }

  // ===== 应用生命周期 =====
  app.whenReady().then(() => {
    createWindow();
    createTray();
    registerShortcuts();
    setupIPC();
    scheduleAllReminders();
    scheduleAllAlarms();
    scheduleAnniversaryReminders();
    startOverdueCheck();

    const autoStart = store.get('settings.autoStart');
    if (autoStart) setAutoStart(true);

    const args = process.argv;
    if (args.includes('--minimized')) {
      if (mainWindow) mainWindow.hide();
    }

    // 定期更新托盘菜单（每30秒）
    setInterval(() => {
      updateTrayTooltip();
      updateTrayContextMenu();
    }, 30000);
  });

  app.on('window-all-closed', () => {
    // Windows 下不自动退出，保持在托盘运行
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    reminderTimers.forEach(t => clearTimeout(t));
    reminderTimers.clear();
    alarmTimers.forEach(t => clearTimeout(t));
    alarmTimers.clear();
    if (overdueCheckInterval) clearInterval(overdueCheckInterval);
  });
}
// 单实例锁判断结束
