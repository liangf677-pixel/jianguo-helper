/**
 * 坚果 - 预加载脚本
 * 通过 contextBridge 安全地暴露 IPC 方法给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ===== 任务操作 =====
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks),
  addTask: (task) => ipcRenderer.invoke('add-task', task),
  updateTask: (task) => ipcRenderer.invoke('update-task', task),
  deleteTask: (taskId) => ipcRenderer.invoke('delete-task', taskId),
  batchUpdateTasks: (taskIds, updates) => ipcRenderer.invoke('batch-update-tasks', { taskIds, updates }),
  batchDeleteTasks: (taskIds) => ipcRenderer.invoke('batch-delete-tasks', taskIds),

  // ===== 闹钟操作 =====
  getAlarms: () => ipcRenderer.invoke('get-alarms'),
  saveAlarms: (alarms) => ipcRenderer.invoke('save-alarms', alarms),

  // ===== 便签操作 =====
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNotes: (notes) => ipcRenderer.invoke('save-notes', notes),

  // ===== 纪念日操作 =====
  getAnniversaries: () => ipcRenderer.invoke('get-anniversaries'),
  saveAnniversaries: (anniversaries) => ipcRenderer.invoke('save-anniversaries', anniversaries),

  // ===== 设置操作 =====
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // ===== 数据备份与恢复 =====
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),

  // ===== 系统功能 =====
  showConfirmDialog: (options) => ipcRenderer.invoke('show-confirm-dialog', options),
  getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // ===== 事件监听 =====
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (_, view) => callback(view));
  },
  onOpenNewTask: (callback) => {
    ipcRenderer.on('open-new-task', () => callback());
  },
  onAlarmTriggered: (callback) => {
    ipcRenderer.on('alarm-triggered', (_, alarm) => callback(alarm));
  },
  onOverdueUpdate: (callback) => {
    ipcRenderer.on('overdue-update', (_, count) => callback(count));
  },
  onAutoSave: (callback) => {
    ipcRenderer.on('auto-save', () => callback());
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('navigate');
    ipcRenderer.removeAllListeners('open-new-task');
    ipcRenderer.removeAllListeners('alarm-triggered');
    ipcRenderer.removeAllListeners('overdue-update');
    ipcRenderer.removeAllListeners('auto-save');
  }
});
