/**
 * 坚果 - 时钟与闹钟模块
 * 使用事件委托处理闹钟管理、倒计时器、秒表功能
 */
const ClockModule = {
  alarmState: { currentAlarm: null, snoozeTimeout: null },

  timerState: {
    type: 'countdown', running: false,
    totalSeconds: 0, remainingSeconds: 0,
    laps: [], intervalId: null,
    startTime: null, elapsedBefore: 0
  },

  // ===== 事件委托入口 =====
  handleEvent(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'new-alarm':       e.preventDefault(); this.openAlarmModal(); break;
      case 'edit-alarm':      e.preventDefault(); this.openAlarmModal(id); break;
      case 'delete-alarm':    e.preventDefault(); this.deleteAlarm(id); break;
      case 'toggle-alarm':    this.toggleAlarm(id, e.target.checked); break;
      case 'timer-start':     e.preventDefault(); this.startTimer(); break;
      case 'timer-pause':     e.preventDefault(); this.pauseTimer(); break;
      case 'timer-reset':     e.preventDefault(); this.resetTimer(); break;
      case 'timer-lap':       e.preventDefault(); this.recordLap(); break;
      case 'timer-switch':    e.preventDefault(); this.switchType(btn.dataset.type); break;
      case 'timer-preset':    e.preventDefault(); this.setPreset(parseInt(btn.dataset.min), parseInt(btn.dataset.sec)); break;
      case 'alarm-dismiss':   e.preventDefault(); this.dismissAlarm(); break;
      case 'alarm-snooze':    e.preventDefault(); this.snoozeAlarm(parseInt(btn.dataset.min)); break;
    }
  },

  // ===== 闹钟视图 =====
  renderAlarms(area) {
    const alarms = App.state.alarms;
    area.innerHTML = `
      <div class="alarm-module">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin:0;">闹钟管理</h2>
          <button class="btn btn-primary" data-action="new-alarm">+ 新建闹钟</button>
        </div>
        <div>${alarms.length === 0 ? this.renderEmptyAlarms() : alarms.sort((a,b) => (a.time||'').localeCompare(b.time||'')).map(a => this.renderAlarmItem(a)).join('')}</div>
      </div>`;
  },

  renderEmptyAlarms() {
    return `<div class="empty-state"><i>⏰</i><div class="empty-state-title">还没有闹钟</div>
      <div class="empty-state-desc">点击"新建闹钟"创建闹钟</div></div>`;
  },

  renderAlarmItem(a) {
    const dayMap = {mon:'周一',tue:'周二',wed:'周三',thu:'周四',fri:'周五',sat:'周六',sun:'周日'};
    const repeatText = a.repeatDays?.length > 0 ? '重复: ' + a.repeatDays.map(d => dayMap[d] || d).join(', ') : '单次闹钟';
    return `
      <div class="card mb-2" style="opacity:${a.enabled ? '1' : '0.5'}">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:16px;">
            <span style="font-size:32px;font-weight:700;font-family:Consolas,monospace;">${a.time||'00:00'}</span>
            <div>
              <div style="font-size:14px;font-weight:600;">${this.esc(a.name) || '闹钟'}</div>
              <div style="font-size:12px;color:var(--text-tertiary);">${repeatText}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <label class="toggle">
              <input type="checkbox" ${a.enabled ? 'checked' : ''} data-action="toggle-alarm" data-id="${a.id}">
              <span class="toggle-slider"></span>
            </label>
            <button class="btn btn-ghost btn-icon btn-sm" data-action="edit-alarm" data-id="${a.id}" title="编辑">✎</button>
            <button class="btn btn-ghost btn-icon btn-sm" data-action="delete-alarm" data-id="${a.id}" title="删除" style="color:var(--danger)">🗑</button>
          </div>
        </div>
      </div>`;
  },

  openAlarmModal(alarmId) {
    const alarm = alarmId ? App.state.alarms.find(a => a.id === alarmId) : null;
    document.getElementById('alarmId').value = alarm ? alarm.id : '';
    document.getElementById('alarmTime').value = alarm ? alarm.time : '08:00';
    document.getElementById('alarmName').value = alarm ? (alarm.name || '') : '';
    document.getElementById('alarmEnabled').checked = alarm ? alarm.enabled : true;
    ['mon','tue','wed','thu','fri','sat','sun'].forEach(day => {
      const cb = document.querySelector(`#alarmForm input[value="${day}"]`);
      if (cb) cb.checked = alarm ? (alarm.repeatDays || []).includes(day) : false;
    });
    document.getElementById('alarmModalTitle').textContent = alarm ? '编辑闹钟' : '新建闹钟';
    document.getElementById('alarmModalOverlay').classList.remove('hidden');
  },

  async saveAlarm() {
    const id = document.getElementById('alarmId').value;
    const time = document.getElementById('alarmTime').value;
    const name = document.getElementById('alarmName').value.trim();
    const enabled = document.getElementById('alarmEnabled').checked;
    if (!time) { App.showToast('请设置闹钟时间', 'warning'); return; }
    const repeatDays = [];
    ['mon','tue','wed','thu','fri','sat','sun'].forEach(day => {
      const cb = document.querySelector(`#alarmForm input[value="${day}"]`);
      if (cb?.checked) repeatDays.push(day);
    });
    const alarmData = { id: id || Date.now().toString(36) + Math.random().toString(36).substr(2,6), time, name, enabled, repeatDays };
    const alarms = [...App.state.alarms];
    if (id) { const idx = alarms.findIndex(a => a.id === id); if (idx !== -1) alarms[idx] = alarmData; }
    else alarms.push(alarmData);
    try {
      await window.electronAPI.saveAlarms(alarms);
      App.state.alarms = alarms;
      App.showToast(id ? '闹钟已更新' : '闹钟已创建', 'success');
      this.closeAlarmModal();
      this.renderAlarms(document.getElementById('contentArea'));
    } catch (e) { App.showToast('保存失败: ' + e.message, 'error'); }
  },

  closeAlarmModal() { document.getElementById('alarmModalOverlay').classList.add('hidden'); },
  async deleteAlarm(alarmId) {
    if (!alarmId) return;
    const a = App.state.alarms.find(x => x.id === alarmId); if (!a) return;
    if (!await App.showConfirm('删除闹钟', `确定删除"${a.name || a.time}"吗？`)) return;
    App.state.alarms = App.state.alarms.filter(x => x.id !== alarmId);
    await window.electronAPI.saveAlarms(App.state.alarms);
    App.showToast('闹钟已删除', 'success');
    this.renderAlarms(document.getElementById('contentArea'));
  },
  async toggleAlarm(alarmId, enabled) {
    const alarms = [...App.state.alarms];
    const idx = alarms.findIndex(a => a.id === alarmId);
    if (idx !== -1) { alarms[idx].enabled = enabled; App.state.alarms = alarms; await window.electronAPI.saveAlarms(alarms); }
  },

  // ===== 闹钟响铃 =====
  showAlarmFullscreen(alarm) {
    this.alarmState.currentAlarm = alarm;
    document.getElementById('alarmFullTime').textContent = alarm.time;
    document.getElementById('alarmFullName').textContent = alarm.name || '闹钟';
    document.getElementById('alarmFullscreen').classList.remove('hidden');
    this.playBeep();
  },
  dismissAlarm() {
    document.getElementById('alarmFullscreen').classList.add('hidden');
    this.alarmState.currentAlarm = null;
    if (this.alarmState.snoozeTimeout) { clearTimeout(this.alarmState.snoozeTimeout); this.alarmState.snoozeTimeout = null; }
  },
  snoozeAlarm(minutes) {
    document.getElementById('alarmFullscreen').classList.add('hidden');
    App.showToast(`闹钟将在 ${minutes} 分钟后再次提醒`, 'info');
    this.alarmState.snoozeTimeout = setTimeout(() => {
      if (this.alarmState.currentAlarm) this.showAlarmFullscreen(this.alarmState.currentAlarm);
    }, minutes * 60000);
  },
  playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (f, d, t) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = f; o.type = 'sine'; g.gain.value = 0.3; g.gain.exponentialRampToValueAtTime(0.01, t+d); o.start(t); o.stop(t+d); };
      const n = ctx.currentTime;
      for (let i = 0; i < 4; i++) beep(800, 0.2, n + i * 0.4);
    } catch (e) { /* 忽略 */ }
  },

  // ===== 计时器 =====
  renderTimer(area) {
    const ts = this.timerState;
    area.innerHTML = `
      <div class="timer-module">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin:0;">计时器</h2>
          <div class="btn-group">
            <button class="btn btn-sm ${ts.type==='countdown'?'btn-primary':'btn-outline'}" data-action="timer-switch" data-type="countdown">倒计时</button>
            <button class="btn btn-sm ${ts.type==='stopwatch'?'btn-primary':'btn-outline'}" data-action="timer-switch" data-type="stopwatch">秒表</button>
          </div>
        </div>
        <div class="card" style="text-align:center;">${ts.type === 'countdown' ? this.renderCountdown() : this.renderStopwatch()}</div>
      </div>`;
  },

  renderCountdown() {
    const ts = this.timerState;
    return `
      ${!ts.running && ts.remainingSeconds === 0 ? `
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px;">
          <div style="text-align:center;"><input type="number" id="timerHours" class="form-input" style="width:70px;text-align:center;font-size:20px;" value="0" min="0" max="99"><div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">时</div></div>
          <span style="font-size:24px;font-weight:700;line-height:2;">:</span>
          <div style="text-align:center;"><input type="number" id="timerMinutes" class="form-input" style="width:70px;text-align:center;font-size:20px;" value="25" min="0" max="59"><div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">分</div></div>
          <span style="font-size:24px;font-weight:700;line-height:2;">:</span>
          <div style="text-align:center;"><input type="number" id="timerSeconds" class="form-input" style="width:70px;text-align:center;font-size:20px;" value="0" min="0" max="59"><div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">秒</div></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;">
          <button class="btn btn-outline btn-sm" data-action="timer-preset" data-min="25" data-sec="0">25分 番茄钟</button>
          <button class="btn btn-outline btn-sm" data-action="timer-preset" data-min="5" data-sec="0">5分 休息</button>
          <button class="btn btn-outline btn-sm" data-action="timer-preset" data-min="15" data-sec="0">15分钟</button>
          <button class="btn btn-outline btn-sm" data-action="timer-preset" data-min="0" data-sec="30">30秒</button>
        </div>
      ` : `<div class="timer-display">${this.fmt(ts.remainingSeconds)}</div>`}
      <div class="timer-controls">
        ${!ts.running ? `<button class="btn btn-primary btn-lg" data-action="timer-start">${ts.remainingSeconds > 0 ? '继续' : '开始'}</button>`
          : `<button class="btn btn-warning btn-lg" data-action="timer-pause">暂停</button>`}
        ${ts.remainingSeconds > 0 || ts.running ? `<button class="btn btn-outline btn-lg" data-action="timer-reset">重置</button>` : ''}
      </div>`;
  },

  renderStopwatch() {
    const ts = this.timerState;
    const display = this.fmt(ts.elapsedBefore + (ts.running ? (Date.now() - ts.startTime) / 1000 : 0));
    return `
      <div class="timer-display">${display}</div>
      <div class="timer-controls">
        ${!ts.running ? `<button class="btn btn-primary btn-lg" data-action="timer-start">${ts.elapsedBefore > 0 ? '继续' : '开始'}</button>`
          : `<button class="btn btn-warning btn-lg" data-action="timer-pause">暂停</button>`}
        ${ts.running ? `<button class="btn btn-outline btn-lg" data-action="timer-lap">计次</button>` : ''}
        ${ts.elapsedBefore > 0 || ts.running ? `<button class="btn btn-outline btn-lg" data-action="timer-reset">重置</button>` : ''}
      </div>
      ${ts.laps.length > 0 ? `<div class="lap-list">${ts.laps.map((lap, i) => `
        <div class="lap-item"><span>第${i+1}次</span><span>${this.fmt(lap.time)}</span>${i > 0 ? `<span style="color:var(--text-tertiary);font-size:11px;">+${this.fmt(lap.time - ts.laps[i-1].time)}</span>` : ''}</div>
      `).join('')}</div>` : ''}`;
  },

  fmt(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600), m = Math.floor((totalSeconds % 3600) / 60), s = Math.floor(totalSeconds % 60), ms = Math.floor((totalSeconds % 1) * 100);
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
  },

  switchType(type) { this.resetTimer(); this.timerState.type = type; this.renderTimer(document.getElementById('contentArea')); },
  setPreset(min, sec) { const h = document.getElementById('timerHours'), m = document.getElementById('timerMinutes'), s = document.getElementById('timerSeconds'); if (h) h.value = 0; if (m) m.value = min; if (s) s.value = sec; },

  startTimer() {
    const ts = this.timerState;
    if (ts.type === 'countdown' && ts.remainingSeconds === 0) {
      // 从 DOM 读取输入值
      const hInput = document.getElementById('timerHours');
      const mInput = document.getElementById('timerMinutes');
      const sInput = document.getElementById('timerSeconds');
      if (!mInput) { App.showToast('请设置倒计时时间', 'warning'); return; }
      const h = parseInt(hInput?.value) || 0;
      const m = parseInt(mInput.value) || 0;
      const s = parseInt(sInput?.value) || 0;
      ts.totalSeconds = h * 3600 + m * 60 + s;
      ts.remainingSeconds = ts.totalSeconds;
      if (ts.remainingSeconds <= 0) { App.showToast('请设置倒计时时间', 'warning'); return; }
    }
    ts.running = true;
    ts.startTime = Date.now();

    // 先更新显示（渲染计时器界面）
    this.renderTimer(document.getElementById('contentArea'));

    // 然后启动定时器更新显示文字
    if (ts.type === 'countdown') {
      const startRemaining = ts.remainingSeconds;
      this.startTick(() => {
        ts.remainingSeconds = Math.max(0, startRemaining - (Date.now() - ts.startTime) / 1000);
        if (ts.remainingSeconds <= 0) this.timerFinished();
      });
    } else {
      this.startTick();
    }
  },

  startTick(onTick) {
    this.stopTick();
    const ts = this.timerState;
    ts.intervalId = setInterval(() => {
      if (onTick) onTick();

      // 如果计时器视图不存在（用户已导航到其他页面），停止刷新
      const timerModule = document.querySelector('.timer-module');
      if (!timerModule) { this.stopTick(); return; }

      // 只更新显示文本，而不是替换整个 DOM
      const display = timerModule.querySelector('.timer-display');
      if (display) {
        if (ts.type === 'countdown') {
          display.textContent = this.fmt(ts.remainingSeconds);
        } else {
          display.textContent = this.fmt(ts.elapsedBefore + (ts.running ? (Date.now() - ts.startTime) / 1000 : 0));
        }
      }
    }, 50);
  },
  stopTick() { if (this.timerState.intervalId) { clearInterval(this.timerState.intervalId); this.timerState.intervalId = null; } },
  pauseTimer() {
    const ts = this.timerState;
    ts.running = false;
    this.stopTick();
    if (ts.type === 'stopwatch') ts.elapsedBefore += (Date.now() - ts.startTime) / 1000;
    else ts.remainingSeconds = Math.max(0, ts.remainingSeconds - (Date.now() - ts.startTime) / 1000);
    this.renderTimer(document.getElementById('contentArea'));
  },
  resetTimer() {
    this.stopTick();
    const ts = this.timerState;
    ts.running = false; ts.totalSeconds = 0; ts.remainingSeconds = 0; ts.elapsedBefore = 0; ts.laps = []; ts.startTime = null;
    this.renderTimer(document.getElementById('contentArea'));
  },
  recordLap() {
    const ts = this.timerState;
    ts.laps.push({ time: ts.elapsedBefore + (ts.running ? (Date.now() - ts.startTime) / 1000 : 0) });
    this.renderTimer(document.getElementById('contentArea'));
  },
  timerFinished() {
    this.pauseTimer(); this.timerState.remainingSeconds = 0;
    App.showToast('倒计时结束！', 'info', 5000);
    this.playBeep();
  },
  esc(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
};

// ===== 绑定事件 =====
document.addEventListener('DOMContentLoaded', () => {
  const area = document.getElementById('contentArea');
  if (!area) return;

  area.addEventListener('click', (e) => ClockModule.handleEvent(e));
  area.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action]');
    if (el?.dataset.action === 'toggle-alarm') ClockModule.handleEvent(e);
  });

  // 闹钟模态框事件
  document.getElementById('alarmModalClose').addEventListener('click', () => ClockModule.closeAlarmModal());
  document.getElementById('alarmModalCancel').addEventListener('click', () => ClockModule.closeAlarmModal());
  document.getElementById('alarmModalSave').addEventListener('click', () => ClockModule.saveAlarm());
  document.getElementById('alarmModalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) ClockModule.closeAlarmModal(); });

  // 闹钟响铃事件
  document.getElementById('alarmDismiss').addEventListener('click', () => ClockModule.dismissAlarm());
  document.querySelectorAll('.alarm-snooze').forEach(btn => {
    btn.addEventListener('click', () => ClockModule.snoozeAlarm(parseInt(btn.dataset.min)));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { ClockModule.dismissAlarm(); ClockModule.closeAlarmModal(); }
  });
});
