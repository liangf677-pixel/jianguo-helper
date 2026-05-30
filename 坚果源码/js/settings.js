/**
 * 坚果 - 设置模块
 * 使用事件委托处理所有设置项：主题、通知、天气、数据管理等
 */
const SettingsModule = {
  handleEvent(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const key = el.dataset.key;
    let value;

    switch (action) {
      case 'toggle-setting':
        value = e.target.checked;
        break;
      case 'select-setting':
        value = el.value === 'true' ? true : el.value === 'false' ? false : isNaN(el.value) ? el.value : parseInt(el.value);
        break;
      case 'input-setting':
        value = el.value.trim();
        break;
      case 'color-setting':
        value = el.dataset.color || el.value;
        break;
      case 'export-data':
        e.preventDefault(); this.exportData(); return;
      case 'import-data':
        e.preventDefault(); this.importData(); return;
      case 'clear-data':
        e.preventDefault(); this.clearAllData(); return;
      default: return;
    }

    if (key) this.updateSetting(key, value);
  },

  render(area) {
    const s = App.state.settings;
    area.innerHTML = `
      <div class="settings-module" style="max-width:800px;margin:0 auto;">
        ${this.section('外观设置', [
          { type: 'select', key: 'theme', label: '主题模式', desc: '切换浅色/深色主题', options: [{v:'light',t:'浅色主题'},{v:'dark',t:'深色主题'}], val: s.theme || 'light' },
          { type: 'color', key: 'accentColor', label: '主题色', desc: '自定义应用的主色调', val: s.accentColor || '#3b82f6',
            colors: ['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'] },
          { type: 'select', key: 'fontSize', label: '字体大小', desc: '调整应用中文字的显示大小', options: [{v:'small',t:'小'},{v:'medium',t:'中'},{v:'large',t:'大'}], val: s.fontSize || 'medium' },
          { type: 'select', key: 'timeFormat', label: '时间格式', desc: '选择 12 小时制或 24 小时制', options: [{v:'24h',t:'24 小时制'},{v:'12h',t:'12 小时制'}], val: s.timeFormat || '24h' },
        ])}
        ${this.section('通知设置', [
          { type: 'toggle', key: 'notifications', label: '启用通知', desc: '开启/关闭所有桌面通知', val: s.notifications !== false },
          { type: 'range', key: 'notificationVolume', label: '通知音量', desc: '调整提醒音的音量大小', val: s.notificationVolume || 80 },
          { type: 'select', key: 'notificationDuration', label: '通知显示时长', desc: '通知弹窗的显示时长', options: [{v:3000,t:'3 秒'},{v:5000,t:'5 秒'},{v:10000,t:'10 秒'}], val: s.notificationDuration || 5000 },
        ])}
        ${this.section('系统设置', [
          { type: 'toggle', key: 'minimizeToTray', label: '关闭窗口时最小化到托盘', desc: '点击关闭按钮时隐藏到系统托盘而不是退出', val: s.minimizeToTray !== false },
          { type: 'toggle', key: 'autoStart', label: '开机自启', desc: '系统启动时自动运行应用', val: !!s.autoStart },
          { type: 'select', key: 'autoSaveInterval', label: '自动保存间隔', desc: '数据自动保存的时间间隔', options: [{v:15000,t:'15 秒'},{v:30000,t:'30 秒'},{v:60000,t:'1 分钟'},{v:120000,t:'2 分钟'}], val: s.autoSaveInterval || 30000 },
          { type: 'input', key: 'globalShortcutOpen', label: '全局快捷键 - 打开应用', desc: '快速打开/显示应用窗口', val: s.globalShortcutOpen || 'Ctrl+Shift+T' },
          { type: 'input', key: 'globalShortcutNewTask', label: '全局快捷键 - 新建任务', desc: '快速创建新任务', val: s.globalShortcutNewTask || 'Ctrl+Shift+N' },
        ])}
        ${this.section('天气设置', [
          { type: 'toggle', key: 'weatherEnabled', label: '启用天气功能', desc: '使用 Open-Meteo 免费天气服务', val: s.weatherEnabled !== false },
          { type: 'input', key: 'weatherLat', label: '纬度', desc: '当前位置纬度（默认：绵阳 31.46）', val: String(s.weatherLat || 31.46), isNum: true },
          { type: 'input', key: 'weatherLon', label: '经度', desc: '当前位置经度（默认：绵阳 104.68）', val: String(s.weatherLon || 104.68), isNum: true },
          { type: 'input', key: 'weatherCity', label: '城市名称', desc: '仅用于界面显示', val: s.weatherCity || '绵阳' },
          { type: 'select', key: 'weatherUpdateInterval', label: '更新间隔', desc: '天气数据自动更新的时间间隔', options: [{v:15,t:'15 分钟'},{v:30,t:'30 分钟'},{v:60,t:'1 小时'}], val: s.weatherUpdateInterval || 30 },
        ])}
        ${this.dataSection()}
        ${this.aboutSection()}
      </div>`;
    this.loadStorageInfo();
  },

  section(title, items) {
    return `<div class="settings-section"><div class="settings-section-title">${title}</div><div class="card">${items.map(it => this.renderItem(it)).join('')}</div></div>`;
  },

  renderItem(it) {
    let control = '';
    if (it.type === 'toggle') {
      control = `<label class="toggle"><input type="checkbox" ${it.val ? 'checked' : ''} data-action="toggle-setting" data-key="${it.key}"><span class="toggle-slider"></span></label>`;
    } else if (it.type === 'select') {
      control = `<select class="form-select" data-action="select-setting" data-key="${it.key}">${it.options.map(o => `<option value="${o.v}" ${String(it.val) === String(o.v) ? 'selected' : ''}>${o.t}</option>`).join('')}</select>`;
    } else if (it.type === 'color') {
      control = `<div class="color-presets">${it.colors.map(c => `<div class="color-preset ${it.val === c ? 'active' : ''}" style="background:${c};" data-action="color-setting" data-key="${it.key}" data-color="${c}" title="${c}"></div>`).join('')}<input type="color" value="${it.val}" style="width:28px;height:28px;border:none;cursor:pointer;border-radius:50%;" data-action="color-setting" data-key="${it.key}"></div>`;
    } else if (it.type === 'range') {
      control = `<div style="display:flex;align-items:center;gap:8px;"><input type="range" min="0" max="100" value="${it.val}" style="width:120px;" data-action="select-setting" data-key="${it.key}"><span style="font-size:13px;">${it.val}%</span></div>`;
    } else if (it.type === 'input') {
      control = `<input type="${it.isNum ? 'number' : 'text'}" class="form-input" style="width:${it.isNum ? '100px' : '180px'};" value="${it.val}" ${it.isNum ? 'step="0.01"' : ''} data-action="input-setting" data-key="${it.key}">`;
    }
    return `<div class="setting-row"><div><div class="setting-label">${it.label}</div><div class="setting-desc">${it.desc}</div></div><div class="setting-control">${control}</div></div>`;
  },

  dataSection() {
    return `<div class="settings-section"><div class="settings-section-title">数据管理</div><div class="card">
      <div class="setting-row"><div><div class="setting-label">导出数据</div><div class="setting-desc">将所有数据导出为 JSON 文件备份</div></div><div class="setting-control"><button class="btn btn-outline" data-action="export-data">导出备份</button></div></div>
      <div class="setting-row"><div><div class="setting-label">导入数据</div><div class="setting-desc">从 JSON 备份文件恢复数据</div></div><div class="setting-control"><button class="btn btn-outline" data-action="import-data">导入数据</button></div></div>
      <div class="setting-row"><div><div class="setting-label">清除所有数据</div><div class="setting-desc" style="color:var(--danger);">删除所有数据，不可恢复</div></div><div class="setting-control"><button class="btn btn-danger" data-action="clear-data">清除数据</button></div></div>
      <div class="divider"></div><div id="storageInfo"><span style="font-size:12px;color:var(--text-tertiary);">加载中...</span></div>
    </div></div>`;
  },

  aboutSection() {
    return `<div class="settings-section"><div class="settings-section-title">关于</div><div class="card">
      <div style="text-align:center;padding:20px;">
        <div style="font-size:24px;font-weight:700;margin-bottom:4px;">坚果</div>
        <div style="font-size:13px;color:var(--text-secondary);">版本 1.0.1</div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">纯本地运行 · 无需联网 · 不收集任何数据<br>基于 Electron 构建 · 天气数据来源：Open-Meteo</div>
      </div>
    </div></div>`;
  },

  async updateSetting(key, value) {
    App.state.settings[key] = value;
    await window.electronAPI.saveSettings(App.state.settings);

    switch (key) {
      case 'theme': App.applyTheme(); break;
      case 'fontSize': App.applyFontSize(); break;
      case 'accentColor': App.applyAccentColor(); break;
      case 'timeFormat': App.startClock(); break;
      case 'weatherEnabled': case 'weatherLat': case 'weatherLon': case 'weatherCity': case 'weatherUpdateInterval':
        WeatherModule.startAutoUpdate(); break;
    }
    App.showToast('设置已保存', 'success');
  },

  async exportData() {
    try {
      const r = await window.electronAPI.exportData();
      if (r.success) App.showToast(`数据已导出`, 'success');
      else if (r.reason !== 'cancelled') App.showToast('导出失败: ' + r.reason, 'error');
    } catch (e) { App.showToast('导出失败: ' + e.message, 'error'); }
  },

  async importData() {
    if (!await App.showConfirm('导入数据', '导入数据将覆盖当前所有数据，确定继续吗？')) return;
    try {
      const r = await window.electronAPI.importData();
      if (r.success) {
        App.state.tasks = await window.electronAPI.getTasks();
        App.state.alarms = await window.electronAPI.getAlarms();
        App.state.notes = await window.electronAPI.getNotes();
        App.state.anniversaries = await window.electronAPI.getAnniversaries();
        App.state.settings = await window.electronAPI.getSettings();
        App.applyTheme(); App.applyFontSize(); App.applyAccentColor(); App.startClock(); App.updateBadges();
        this.render(document.getElementById('contentArea'));
        App.showToast('数据已成功导入', 'success');
      } else if (r.reason !== 'cancelled') App.showToast('导入失败: ' + r.reason, 'error');
    } catch (e) { App.showToast('导入失败: ' + e.message, 'error'); }
  },

  async clearAllData() {
    if (!await App.showConfirm('清除所有数据', '此操作将永久删除所有数据且不可恢复。确定继续吗？')) return;
    if (!await App.showConfirm('再次确认', '你真的确定要清除所有数据吗？')) return;
    try {
      await window.electronAPI.clearAllData();
      App.state.tasks = []; App.state.alarms = []; App.state.notes = []; App.state.anniversaries = [];
      App.showToast('所有数据已清除', 'success'); App.updateBadges();
      this.render(document.getElementById('contentArea'));
    } catch (e) { App.showToast('清除失败: ' + e.message, 'error'); }
  },

  async loadStorageInfo() {
    try {
      const info = await window.electronAPI.getStorageInfo();
      const el = document.getElementById('storageInfo');
      if (el) el.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);display:flex;gap:20px;flex-wrap:wrap;">
        <span>存储路径: ${info.path}</span><span>数据大小: ${info.size}</span><span>任务: ${info.taskCount} 个</span><span>便签: ${info.noteCount} 个</span><span>闹钟: ${info.alarmCount} 个</span></div>`;
    } catch (e) { /* 忽略 */ }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const area = document.getElementById('contentArea');
  if (!area) return;
  area.addEventListener('click', (e) => SettingsModule.handleEvent(e));
  area.addEventListener('change', (e) => SettingsModule.handleEvent(e));
  area.addEventListener('input', App.debounce((e) => {
    const el = e.target.closest('[data-action="input-setting"]');
    if (el) { App.state.settings[el.dataset.key] = el.value.trim(); window.electronAPI.saveSettings(App.state.settings); }
  }, 500));
});
