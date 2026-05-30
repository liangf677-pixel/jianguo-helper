/**
 * 坚果 - 任务管理模块
 * 使用事件委托处理所有任务操作：创建、编辑、查看、筛选、搜索、批量操作、拖拽排序
 */
const TaskModule = {
  filterState: { category: 'all', priority: 'all', search: '' },
  selectedTasks: new Set(),

  // ===== 视图入口 =====
  async renderToday(area)    { await this.refreshTasks(); this.renderView(area, 'today'); },
  async renderUpcoming(area)  { await this.refreshTasks(); this.renderView(area, 'upcoming'); },
  async renderAll(area)       { await this.refreshTasks(); this.renderView(area, 'all'); },
  async renderCompleted(area) { await this.refreshTasks(); this.renderView(area, 'completed'); },
  async renderOverdue(area)   { await this.refreshTasks(); this.renderView(area, 'overdue'); },

  async refreshTasks() {
    try { App.state.tasks = await window.electronAPI.getTasks(); } catch (e) { console.error('获取任务失败:', e); }
  },

  // ===== 获取视图对应的任务列表 =====
  getFilteredTasks(viewType) {
    const now = new Date();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekLater = new Date(today); weekLater.setDate(weekLater.getDate() + 7);

    let tasks = [];
    switch (viewType) {
      case 'today':
        tasks = App.state.tasks.filter(t => {
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return d >= today && d < tomorrow;
        });
        break;
      case 'upcoming':
        tasks = App.state.tasks.filter(t => {
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return d >= today && d < weekLater;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        break;
      case 'all':
        tasks = App.state.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress')
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'completed':
        tasks = App.state.tasks.filter(t => t.status === 'completed')
          .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt));
        break;
      case 'overdue':
        tasks = App.state.tasks.filter(t => {
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          if (!t.dueDate) return false;
          return new Date(t.dueDate) < now;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        break;
    }
    return tasks;
  },

  // ===== 主渲染方法 =====
  renderView(area, viewType) {
    this.selectedTasks.clear();
    const allTasks = this.getFilteredTasks(viewType);

    // 应用筛选
    let tasks = [...allTasks];
    if (this.filterState.category !== 'all')
      tasks = tasks.filter(t => t.category === this.filterState.category);
    if (this.filterState.priority !== 'all')
      tasks = tasks.filter(t => t.priority === this.filterState.priority);
    if (this.filterState.search) {
      const q = this.filterState.search.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.desc && t.desc.toLowerCase().includes(q)));
    }

    const categories = [...new Set(App.state.tasks.map(t => t.category).filter(Boolean))];

    const viewTitles = {
      today: '今日任务', upcoming: '即将到期', all: '全部任务',
      completed: '已完成', overdue: '已逾期'
    };
    const viewDescs = {
      today: '今天需要完成的任务', upcoming: '未来 7 天内到期的任务',
      all: '所有待完成和进行中的任务', completed: '所有已完成的任务',
      overdue: '已过截止日期但未完成的任务'
    };

    area.innerHTML = `
      <div class="task-view" data-view="${viewType}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin:0;">${viewTitles[viewType]}</h2>
            <p style="font-size:12px;color:var(--text-tertiary);margin:4px 0 0;">${viewDescs[viewType]} · 共 ${tasks.length} 个任务</p>
          </div>
        </div>
        <div class="toolbar">
          <button class="btn btn-primary" data-action="new-task">+ 新建任务</button>
          ${viewType !== 'completed' ? `
            <button class="btn btn-outline btn-sm" data-action="batch-complete" disabled>批量完成</button>
          ` : ''}
          <button class="btn btn-outline btn-sm" data-action="batch-delete" disabled>批量删除</button>
          <div class="toolbar-spacer"></div>
          <select class="form-select" data-action="filter-category" style="width:auto;">
            <option value="all" ${this.filterState.category === 'all' ? 'selected' : ''}>全部分类</option>
            ${categories.map(c => `<option value="${c}" ${this.filterState.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <select class="form-select" data-action="filter-priority" style="width:auto;">
            <option value="all" ${this.filterState.priority === 'all' ? 'selected' : ''}>全部优先级</option>
            <option value="high" ${this.filterState.priority === 'high' ? 'selected' : ''}>高优先级</option>
            <option value="medium" ${this.filterState.priority === 'medium' ? 'selected' : ''}>中优先级</option>
            <option value="low" ${this.filterState.priority === 'low' ? 'selected' : ''}>低优先级</option>
          </select>
          <input type="text" class="search-input" placeholder="搜索任务..."
            data-action="search" value="${this.escapeAttr(this.filterState.search)}">
        </div>
        <div class="task-list">
          ${tasks.length === 0 ? this.renderEmpty(viewType) : tasks.map(t => this.renderTaskItem(t, viewType)).join('')}
        </div>
      </div>`;

    // 保存视图类型以便刷新
    area._taskViewType = viewType;
  },

  // ===== 渲染单个任务项 =====
  renderTaskItem(t, viewType) {
    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed' && t.status !== 'cancelled';
    const overdueClass = isOverdue ? 'overdue' : '';
    const completedClass = t.status === 'completed' ? 'completed' : '';
    const selectedClass = this.selectedTasks.has(t.id) ? 'selected' : '';

    return `
      <div class="task-item ${overdueClass} ${completedClass} ${selectedClass}"
           data-task-id="${t.id}" draggable="true">
        <input type="checkbox" class="task-select" data-task-id="${t.id}"
          ${this.selectedTasks.has(t.id) ? 'checked' : ''}>
        <div class="task-checkbox ${t.status === 'completed' ? 'done' : ''}"
             data-action="toggle-complete" data-task-id="${t.id}" title="标记完成">
          ${t.status === 'completed' ? '✓' : ''}
        </div>
        <div class="task-content" data-action="edit-task" data-task-id="${t.id}">
          <div class="task-title">${this.escapeHtml(t.title)}</div>
          ${t.desc ? `<div class="task-desc">${this.escapeHtml(t.desc)}</div>` : ''}
        </div>
        <div class="task-meta">
          ${t.category ? `<span class="badge badge-gray">${this.escapeHtml(t.category)}</span>` : ''}
          <span class="badge badge-${t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'success'}">
            ${t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低'}
          </span>
          ${t.status === 'in_progress' ? '<span class="badge badge-info">进行中</span>' : ''}
          ${t.dueDate ? `<span class="task-date" style="color:${isOverdue ? 'var(--danger)' : ''}">
            ${App.getRelativeDate(t.dueDate)} ${App.formatDate(t.dueDate, false)}
          </span>` : ''}
        </div>
        <div class="task-actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-action="edit-task" data-task-id="${t.id}" title="编辑">✎</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-action="duplicate-task" data-task-id="${t.id}" title="复制">📋</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-action="delete-task" data-task-id="${t.id}" title="删除" style="color:var(--danger)">🗑</button>
        </div>
      </div>`;
  },

  // ===== 空状态 =====
  renderEmpty(viewType) {
    const msgs = {
      today: { title: '今天没有任务', desc: '今天没有需要完成的任务，享受你的一天！' },
      upcoming: { title: '没有即将到期的任务', desc: '未来 7 天内没有任务到期' },
      all: { title: '还没有任务', desc: '点击"+ 新建任务"按钮创建你的第一个任务' },
      completed: { title: '没有已完成的任务', desc: '完成一个任务后它会出现在这里' },
      overdue: { title: '没有逾期任务', desc: '太棒了！所有任务都按时完成了' }
    };
    const m = msgs[viewType] || { title: '没有任务', desc: '' };
    return `<div class="empty-state">
      <i>📋</i>
      <div class="empty-state-title">${m.title}</div>
      <div class="empty-state-desc">${m.desc}</div>
      ${viewType !== 'completed' ? '<button class="btn btn-primary mt-3" data-action="new-task">+ 新建任务</button>' : ''}
    </div>`;
  },

  // ===== 刷新当前视图 =====
  refreshView() {
    const area = document.getElementById('contentArea');
    if (!area || !area._taskViewType) return;
    this.renderView(area, area._taskViewType);
  },

  // ===== 全局事件委托（绑定在 contentArea） =====
  handleEvent(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const taskId = target.dataset.taskId || target.closest('[data-task-id]')?.dataset.taskId;

    switch (action) {
      case 'new-task':         e.preventDefault(); this.openTaskModal(); break;
      case 'edit-task':        e.preventDefault(); this.openTaskModal(taskId); break;
      case 'duplicate-task':   e.preventDefault(); this.duplicateTask(taskId); break;
      case 'delete-task':      e.preventDefault(); this.deleteTask(taskId); break;
      case 'toggle-complete':  e.preventDefault(); this.toggleTaskComplete(taskId); break;
      case 'batch-complete':   e.preventDefault(); this.batchComplete(); break;
      case 'batch-delete':     e.preventDefault(); this.batchDelete(); break;
      case 'filter-category':  this.filterState.category = target.value; this.refreshView(); break;
      case 'filter-priority':  this.filterState.priority = target.value; this.refreshView(); break;
      case 'search':           this.filterState.search = target.value; this.refreshView(); break;
    }
  },

  // 处理复选框选择
  handleCheckboxChange(e) {
    const cb = e.target.closest('.task-select');
    if (!cb) return;
    const taskId = cb.dataset.taskId;
    if (cb.checked) this.selectedTasks.add(taskId);
    else this.selectedTasks.delete(taskId);
    this.updateBatchButtons();
  },

  updateBatchButtons() {
    const count = this.selectedTasks.size;
    const btnComplete = document.querySelector('[data-action="batch-complete"]');
    const btnDelete = document.querySelector('[data-action="batch-delete"]');
    if (btnComplete) btnComplete.disabled = count === 0;
    if (btnDelete) btnDelete.disabled = count === 0;
  },

  // ===== 任务模态框 =====
  openTaskModal(taskId) {
    console.log('打开任务模态框, taskId:', taskId);
    const task = taskId ? App.state.tasks.find(t => t.id === taskId) : null;

    document.getElementById('taskId').value = task ? task.id : '';
    document.getElementById('taskTitle').value = task ? task.title : '';
    document.getElementById('taskDesc').value = task ? (task.desc || '') : '';
    document.getElementById('taskPriority').value = task ? task.priority : 'medium';
    document.getElementById('taskCategory').value = task ? (task.category || '其他') : '其他';
    document.getElementById('taskStatus').value = task ? task.status : 'pending';
    document.getElementById('taskRepeat').value = task ? (task.repeatCycle || 'none') : 'none';
    document.getElementById('taskRemindBefore').value = task ? (task.reminderBefore || '') : '';

    if (task && task.dueDate) {
      const d = new Date(task.dueDate);
      document.getElementById('taskDueDate').value =
        `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } else {
      document.getElementById('taskDueDate').value = '';
    }

    document.getElementById('taskModalTitle').textContent = task ? '编辑任务' : '新建任务';
    document.getElementById('taskModalOverlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('taskTitle').focus(), 100);
  },

  closeTaskModal() {
    document.getElementById('taskModalOverlay').classList.add('hidden');
  },

  async saveTask() {
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
      App.showToast('请输入任务标题', 'warning');
      return;
    }

    const taskData = {
      title,
      desc: document.getElementById('taskDesc').value.trim(),
      priority: document.getElementById('taskPriority').value,
      category: document.getElementById('taskCategory').value,
      status: document.getElementById('taskStatus').value,
      repeatCycle: document.getElementById('taskRepeat').value,
      reminderBefore: document.getElementById('taskRemindBefore').value,
      dueDate: document.getElementById('taskDueDate').value
        ? new Date(document.getElementById('taskDueDate').value).toISOString() : null
    };

    try {
      if (id) {
        taskData.id = id;
        await window.electronAPI.updateTask(taskData);
        App.showToast('任务已更新', 'success');
      } else {
        await window.electronAPI.addTask(taskData);
        App.showToast('任务已创建', 'success');
      }
      this.closeTaskModal();
      await this.refreshTasks();
      this.refreshView();
      App.updateBadges();
    } catch (e) {
      console.error('保存任务失败:', e);
      App.showToast('保存失败: ' + e.message, 'error');
    }
  },

  async deleteTask(taskId) {
    if (!taskId) return;
    const task = App.state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const confirmed = await App.showConfirm('删除任务', `确定要删除任务"${task.title}"吗？`);
    if (!confirmed) return;
    try {
      await window.electronAPI.deleteTask(taskId);
      App.showToast('任务已删除', 'success');
      await this.refreshTasks();
      this.refreshView();
      App.updateBadges();
    } catch (e) {
      App.showToast('删除失败: ' + e.message, 'error');
    }
  },

  async duplicateTask(taskId) {
    if (!taskId) return;
    const task = App.state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const newTask = { ...task };
    delete newTask.id; delete newTask.createdAt; delete newTask.updatedAt; delete newTask.completedAt;
    newTask.title = newTask.title + ' (副本)';
    newTask.status = 'pending';
    try {
      await window.electronAPI.addTask(newTask);
      App.showToast('任务已复制', 'success');
      await this.refreshTasks();
      this.refreshView();
      App.updateBadges();
    } catch (e) {
      App.showToast('复制失败: ' + e.message, 'error');
    }
  },

  async toggleTaskComplete(taskId) {
    if (!taskId) return;
    const task = App.state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await window.electronAPI.updateTask({
        id: taskId,
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null
      });
      App.showToast(newStatus === 'completed' ? '任务已完成 ✓' : '任务已恢复', 'success');
      await this.refreshTasks();
      this.refreshView();
      App.updateBadges();
    } catch (e) {
      App.showToast('操作失败: ' + e.message, 'error');
    }
  },

  // ===== 批量操作 =====
  async batchComplete() {
    if (this.selectedTasks.size === 0) return;
    const ids = [...this.selectedTasks];
    const confirmed = await App.showConfirm('批量完成', `确定要将 ${ids.length} 个任务标记为已完成吗？`);
    if (!confirmed) return;
    try {
      await window.electronAPI.batchUpdateTasks(ids, { status: 'completed', completedAt: new Date().toISOString() });
      App.showToast(`${ids.length} 个任务已完成`, 'success');
      this.selectedTasks.clear();
      await this.refreshTasks();
      this.refreshView();
      App.updateBadges();
    } catch (e) {
      App.showToast('操作失败: ' + e.message, 'error');
    }
  },

  async batchDelete() {
    if (this.selectedTasks.size === 0) return;
    const ids = [...this.selectedTasks];
    const confirmed = await App.showConfirm('批量删除', `确定要删除 ${ids.length} 个任务吗？此操作不可恢复。`);
    if (!confirmed) return;
    try {
      await window.electronAPI.batchDeleteTasks(ids);
      App.showToast(`${ids.length} 个任务已删除`, 'success');
      this.selectedTasks.clear();
      await this.refreshTasks();
      this.refreshView();
      App.updateBadges();
    } catch (e) {
      App.showToast('操作失败: ' + e.message, 'error');
    }
  },

  // ===== 拖拽排序 =====
  onDragStart(e) {
    const item = e.target.closest('.task-item');
    if (!item) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.taskId);
    item.classList.add('dragging');
  },

  onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const item = e.target.closest('.task-item');
    if (item) item.classList.add('drag-over');
  },

  onDragLeave(e) {
    const item = e.target.closest('.task-item');
    if (item) item.classList.remove('drag-over');
  },

  async onDrop(e) {
    e.preventDefault();
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over', 'dragging'));
    const draggedId = e.dataTransfer.getData('text/plain');
    const targetItem = e.target.closest('.task-item');
    if (!targetItem || !draggedId) return;
    const targetId = targetItem.dataset.taskId;
    if (draggedId === targetId) return;

    const tasks = [...App.state.tasks];
    const fromIdx = tasks.findIndex(t => t.id === draggedId);
    const toIdx = tasks.findIndex(t => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = tasks.splice(fromIdx, 1);
    tasks.splice(toIdx, 0, moved);
    App.state.tasks = tasks;
    try {
      await window.electronAPI.saveTasks(tasks);
      this.refreshView();
    } catch (e) {
      App.showToast('排序失败: ' + e.message, 'error');
    }
  },

  // ===== 工具方法 =====
  escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};

// ===== 绑定全局事件 =====
document.addEventListener('DOMContentLoaded', () => {
  const area = document.getElementById('contentArea');
  if (!area) return;

  // 事件委托：处理所有任务相关操作
  area.addEventListener('click', (e) => TaskModule.handleEvent(e));
  area.addEventListener('change', (e) => TaskModule.handleCheckboxChange(e));

  // 拖拽事件
  area.addEventListener('dragstart', (e) => TaskModule.onDragStart(e));
  area.addEventListener('dragover', (e) => TaskModule.onDragOver(e));
  area.addEventListener('dragleave', (e) => TaskModule.onDragLeave(e));
  area.addEventListener('drop', (e) => TaskModule.onDrop(e));

  // 任务模态框事件
  document.getElementById('taskModalClose').addEventListener('click', () => TaskModule.closeTaskModal());
  document.getElementById('taskModalCancel').addEventListener('click', () => TaskModule.closeTaskModal());
  document.getElementById('taskModalSave').addEventListener('click', () => TaskModule.saveTask());
  document.getElementById('taskModalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) TaskModule.closeTaskModal();
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      TaskModule.openTaskModal();
    }
    if (e.key === 'Escape') {
      if (!document.getElementById('taskModalOverlay').classList.contains('hidden')) {
        TaskModule.closeTaskModal();
      }
    }
  });

  console.log('任务管理模块已初始化');
});
