/**
 * 坚果 - 主应用控制器
 * 管理导航、主题、全局状态、初始化
 */
const App = {
  state: {
    currentView: 'tasks-today',
    settings: null,
    tasks: [],
    alarms: [],
    notes: [],
    anniversaries: [],
    clockInterval: null,
    weatherInterval: null,
    alarmCheckInterval: null,
    pendingConfirm: null
  },

  viewTitles: {
    'tasks-today': '今日任务',
    'tasks-upcoming': '即将到期',
    'tasks-all': '全部任务',
    'tasks-completed': '已完成',
    'tasks-overdue': '已逾期',
    'alarms': '闹钟管理',
    'timer': '计时器',
    'weather': '天气预报',
    'notes': '便签',
    'anniversaries': '纪念日',
    'stats': '数据统计',
    'settings': '设置'
  },

  async init() {
    try {
      this.state.settings = await window.electronAPI.getSettings();
      this.state.tasks = await window.electronAPI.getTasks();
      this.state.alarms = await window.electronAPI.getAlarms();
      this.state.notes = await window.electronAPI.getNotes();
      this.state.anniversaries = await window.electronAPI.getAnniversaries();
    } catch (e) {
      console.error('Failed to load data:', e);
      this.state.settings = this.getDefaultSettings();
    }

    this.applyTheme();
    this.applyFontSize();
    this.applyAccentColor();
    this.startClock();
    this.bindNavigation();
    this.bindGlobalEvents();
    this.bindModalEvents();
    this.updateBadges();
    this.navigateTo('tasks-today');

    // 定期更新徽章数字
    setInterval(() => this.updateBadges(), 60000);
  },

  getDefaultSettings() {
    return {
      theme: 'light',
      accentColor: '#3b82f6',
      fontSize: 'medium',
      timeFormat: '24h',
      notifications: true,
      notificationVolume: 80,
      notificationDuration: 5000,
      minimizeToTray: true,
      weatherEnabled: true,
      weatherLat: 31.46,
      weatherLon: 104.68,
      weatherCity: '绵阳'
    };
  },

  applyTheme() {
    const theme = this.state.settings.theme || 'light';
    document.body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
  },

  applyFontSize() {
    const size = this.state.settings.fontSize || 'medium';
    const sizes = { small: '12px', medium: '14px', large: '16px' };
    document.documentElement.style.fontSize = sizes[size] || '14px';
  },

  applyAccentColor() {
    const color = this.state.settings.accentColor || '#3b82f6';
    document.documentElement.style.setProperty('--primary', color);
    // 计算深色变体
    document.documentElement.style.setProperty('--primary-hover', this.adjustColor(color, -20));
    document.documentElement.style.setProperty('--primary-light', this.adjustColor(color, 40, 0.15));
    document.documentElement.style.setProperty('--primary-dark', this.adjustColor(color, -30));
  },

  adjustColor(hex, amount, alpha) {
    let r, g, b;
    if (hex.startsWith('#')) {
      const num = parseInt(hex.slice(1), 16);
      r = (num >> 16) + amount;
      g = ((num >> 8) & 0x00FF) + amount;
      b = (num & 0x0000FF) + amount;
    } else {
      return hex;
    }
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    if (alpha !== undefined) {
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  startClock() {
    const updateClock = () => {
      const now = new Date();
      const timeFormat = this.state.settings.timeFormat || '24h';
      let hours = now.getHours();
      let ampm = '';

      if (timeFormat === '12h') {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12 || 12;
      }

      const h = String(hours).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');

      const clockEl = document.getElementById('digitalClock');
      if (clockEl) {
        clockEl.textContent = `${h}:${m}:${s}${ampm}`;
      }

      const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
      const dateEl = document.getElementById('digitalDate');
      if (dateEl) {
        dateEl.textContent =
          `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`;
      }
    };

    updateClock();
    if (this.state.clockInterval) clearInterval(this.state.clockInterval);
    this.state.clockInterval = setInterval(updateClock, 1000);
  },

  bindNavigation() {
    document.getElementById('sidebarNav').addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (!navItem) return;
      const view = navItem.dataset.view;
      if (view) this.navigateTo(view);
    });

    // 点击天气迷你信息跳转到天气页
    document.getElementById('weatherMini').addEventListener('click', () => {
      this.navigateTo('weather');
    });
  },

  async navigateTo(view) {
    // 停止所有可能运行的定时器
    ClockModule.stopTick();

    this.state.currentView = view;

    // 更新导航高亮
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (activeNav) activeNav.classList.add('active');

    // 更新标题
    document.getElementById('viewTitle').textContent = this.viewTitles[view] || view;

    // 渲染视图
    await this.renderView(view);
  },

  async renderView(view) {
    const area = document.getElementById('contentArea');
    if (!area) return;

    switch (view) {
      case 'tasks-today': await TaskModule.renderToday(area); break;
      case 'tasks-upcoming': await TaskModule.renderUpcoming(area); break;
      case 'tasks-all': await TaskModule.renderAll(area); break;
      case 'tasks-completed': await TaskModule.renderCompleted(area); break;
      case 'tasks-overdue': await TaskModule.renderOverdue(area); break;
      case 'alarms': ClockModule.renderAlarms(area); break;
      case 'timer': ClockModule.renderTimer(area); break;
      case 'weather': WeatherModule.render(area); break;
      case 'notes': NoteModule.render(area); break;
      case 'anniversaries': AnniversaryModule.render(area); break;
      case 'stats': this.renderStats(area); break;
      case 'settings': SettingsModule.render(area); break;
      default: area.innerHTML = '<div class="empty-state"><div class="empty-state-title">未知页面</div></div>';
    }
  },

  bindGlobalEvents() {
    // IPC 事件监听
    if (window.electronAPI) {
      window.electronAPI.onNavigate((view) => this.navigateTo(view));
      window.electronAPI.onOpenNewTask(() => {
        this.navigateTo('tasks-all');
        setTimeout(() => TaskModule.openTaskModal(), 300);
      });
      window.electronAPI.onAlarmTriggered((alarm) => ClockModule.showAlarmFullscreen(alarm));
      window.electronAPI.onOverdueUpdate((count) => {
        const badge = document.getElementById('overdueBadge');
        if (badge) {
          badge.textContent = count;
          badge.classList.toggle('hidden', count === 0);
        }
      });
    }
  },

  bindModalEvents() {
    // 确认对话框
    document.getElementById('confirmModalClose').addEventListener('click', () => this.hideConfirm());
    document.getElementById('confirmModalCancel').addEventListener('click', () => this.hideConfirm());
    document.getElementById('confirmModalOk').addEventListener('click', () => {
      if (this.state.pendingConfirm) {
        this.state.pendingConfirm.resolve(true);
      }
      this.hideConfirm();
    });
  },

  showConfirm(title, message) {
    return new Promise((resolve) => {
      this.state.pendingConfirm = { resolve };
      document.getElementById('confirmModalTitle').textContent = title || '确认';
      document.getElementById('confirmModalMessage').textContent = message || '你确定吗？';
      document.getElementById('confirmModalOverlay').classList.remove('hidden');
    });
  },

  hideConfirm() {
    document.getElementById('confirmModalOverlay').classList.add('hidden');
    this.state.pendingConfirm = null;
  },

  updateBadges() {
    const tasks = this.state.tasks;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekLater = new Date(today); weekLater.setDate(weekLater.getDate() + 7);

    const todayTasks = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= today && d < tomorrow;
    }).length;

    const upcomingTasks = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= today && d < weekLater;
    }).length;

    const overdueTasks = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < today;
    }).length;

    const updateBadge = (id, count) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = count;
        el.classList.toggle('hidden', count === 0);
      }
    };

    updateBadge('todayBadge', todayTasks);
    updateBadge('upcomingBadge', upcomingTasks);
    updateBadge('overdueBadge', overdueTasks);
  },

  renderStats(area) {
    const tasks = this.state.tasks;
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    const overdue = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    }).length;

    // 本月完成数
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCompleted = tasks.filter(t => {
      if (t.status !== 'completed') return false;
      return t.completedAt && new Date(t.completedAt) >= monthStart;
    }).length;

    // 按分类统计
    const categoryStats = {};
    tasks.forEach(t => {
      const cat = t.category || '其他';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });

    area.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--primary-light);color:var(--primary)">&#128203;</div>
          <div><div class="stat-value">${total}</div><div class="stat-label">总任务数</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--success-light);color:var(--success)">&#10003;</div>
          <div><div class="stat-value">${completed}</div><div class="stat-label">已完成</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--warning-light);color:var(--warning)">&#8987;</div>
          <div><div class="stat-value">${pending}</div><div class="stat-label">待完成</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--danger-light);color:var(--danger)">&#9888;</div>
          <div><div class="stat-value">${overdue}</div><div class="stat-label">已逾期</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#cffafe;color:var(--info)">&#128197;</div>
          <div><div class="stat-value">${monthCompleted}</div><div class="stat-label">本月完成</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#f3e8ff;color:#9333ea">&#128161;</div>
          <div><div class="stat-value">${total > 0 ? Math.round(completed / total * 100) : 0}%</div>
          <div class="stat-label">完成率</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">按分类统计</span></div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${Object.entries(categoryStats).map(([cat, count]) => `
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:13px;color:var(--text-primary)">${cat}</span>
                <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${count} 个</span>
              </div>
              <div class="progress-bar">
                <div class="progress-bar-fill" style="width:${total > 0 ? count/total*100 : 0}%"></div>
              </div>
            </div>
          `).join('')}
          ${Object.keys(categoryStats).length === 0 ? '<div class="empty-state-desc">暂无数据</div>' : ''}
        </div>
      </div>
    `;
  },

  async showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  formatDate(dateStr, includeTime = true) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!includeTime) return date;
    return `${date} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  getRelativeDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const absDiff = Math.abs(diff);
    const mins = Math.floor(absDiff / 60000);
    const hours = Math.floor(absDiff / 3600000);
    const days = Math.floor(absDiff / 86400000);

    if (diff < 0) {
      if (days > 0) return `逾期 ${days} 天`;
      if (hours > 0) return `逾期 ${hours} 小时`;
      return '已逾期';
    } else {
      if (days === 0) return '今天';
      if (days === 1) return '明天';
      if (days <= 7) return `${days} 天后`;
      if (days <= 30) return `${Math.ceil(days/7)} 周后`;
      return `${days} 天后`;
    }
  },

  getPriorityIcon(priority) {
    const icons = { high: '&#128308;', medium: '&#128993;', low: '&#128994;' };
    return icons[priority] || '';
  },

  getCategoryIcon(category) {
    const icons = {
      '工作': '&#128188;', '学习': '&#128218;', '生活': '&#127968;',
      '健康': '&#128170;', '社交': '&#128101;', '财务': '&#128176;', '其他': '&#128204;'
    };
    return icons[category] || '&#128204;';
  },

  debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
};

// ===== 启动应用 =====
document.addEventListener('DOMContentLoaded', () => App.init());
