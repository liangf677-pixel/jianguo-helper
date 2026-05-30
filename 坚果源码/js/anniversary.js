/**
 * 坚果 - 纪念日/生日提醒模块
 * 使用事件委托处理纪念日的添加、编辑、删除
 */
const AnniversaryModule = {
  typeLabels: { birthday: '生日', anniversary: '纪念日', festival: '节日', other: '其他' },
  typeIcons: { birthday: '🎂', anniversary: '💕', festival: '🎉', other: '🌟' },

  handleEvent(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    switch (action) {
      case 'new-anniversary': e.preventDefault(); this.openModal(); break;
      case 'edit-anniversary': e.preventDefault(); this.openModal(id); break;
      case 'delete-anniversary': e.preventDefault(); this.deleteAnniversary(id); break;
    }
  },

  render(area) {
    const anniversaries = App.state.anniversaries;
    const sorted = [...anniversaries].sort((a, b) => {
      const now = new Date();
      const aD = new Date(a.date); aD.setFullYear(now.getFullYear()); if (aD < now) aD.setFullYear(now.getFullYear() + 1);
      const bD = new Date(b.date); bD.setFullYear(now.getFullYear()); if (bD < now) bD.setFullYear(now.getFullYear() + 1);
      return aD - bD;
    });

    area.innerHTML = `
      <div class="anniversary-module">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div><h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin:0;">纪念日</h2>
          <p style="font-size:12px;color:var(--text-tertiary);margin:4px 0 0;">管理你的重要日子 · 共 ${anniversaries.length} 个</p></div>
          <button class="btn btn-primary" data-action="new-anniversary">+ 添加纪念日</button>
        </div>
        ${sorted.length === 0 ? this.renderEmpty() : sorted.map(a => this.renderCard(a)).join('')}
      </div>`;
  },

  renderEmpty() {
    return `<div class="empty-state"><i>💕</i><div class="empty-state-title">还没有纪念日</div>
      <div class="empty-state-desc">添加生日、纪念日等重要日子</div></div>`;
  },

  renderCard(ann) {
    const daysUntil = this.getDaysUntil(ann.date);
    const icon = this.typeIcons[ann.type] || '🌟';
    const typeLabel = this.typeLabels[ann.type] || '其他';
    const d = new Date(ann.date);
    let daysText = daysUntil === 0 ? '<span style="color:var(--danger);font-weight:700;">今天！</span>'
      : daysUntil === 1 ? '<span style="color:var(--warning);font-weight:600;">明天</span>'
      : `还有 <strong>${daysUntil}</strong> 天`;
    const remindText = ann.remindBefore > 0 ? `提前 ${ann.remindBefore} 天提醒` : '当天提醒';

    return `
      <div class="card mb-2">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:16px;">
            <span style="font-size:32px;">${icon}</span>
            <div>
              <div style="font-size:16px;font-weight:700;">${this.esc(ann.name)}</div>
              <div style="font-size:12px;color:var(--text-secondary);">
                ${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ·
                <span class="badge badge-info">${typeLabel}</span> · ${remindText}
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="text-align:right;">
              <div style="font-size:22px;font-weight:700;color:var(--primary);">${daysText}</div>
              <div style="font-size:11px;color:var(--text-tertiary);">${d.getMonth()+1}月${d.getDate()}日</div>
            </div>
            <button class="btn btn-ghost btn-icon btn-sm" data-action="edit-anniversary" data-id="${ann.id}" title="编辑">✎</button>
            <button class="btn btn-ghost btn-icon btn-sm" data-action="delete-anniversary" data-id="${ann.id}" title="删除" style="color:var(--danger)">🗑</button>
          </div>
        </div>
      </div>`;
  },

  esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },

  getDaysUntil(dateStr) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setFullYear(now.getFullYear());
    if (target < now) target.setFullYear(now.getFullYear() + 1);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  },

  openModal(anniversaryId) {
    const ann = anniversaryId ? App.state.anniversaries.find(a => a.id === anniversaryId) : null;
    document.getElementById('anniversaryId').value = ann ? ann.id : '';
    document.getElementById('anniversaryName').value = ann ? ann.name : '';
    document.getElementById('anniversaryType').value = ann ? (ann.type || 'other') : 'other';
    document.getElementById('anniversaryRemind').value = ann ? (ann.remindBefore || 0) : 7;
    if (ann?.date) {
      const d = new Date(ann.date);
      document.getElementById('anniversaryDate').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } else document.getElementById('anniversaryDate').value = '';
    document.getElementById('anniversaryModalTitle').textContent = ann ? '编辑纪念日' : '添加纪念日';
    document.getElementById('anniversaryModalOverlay').classList.remove('hidden');
  },

  closeModal() { document.getElementById('anniversaryModalOverlay').classList.add('hidden'); },

  async saveAnniversary() {
    const id = document.getElementById('anniversaryId').value;
    const name = document.getElementById('anniversaryName').value.trim();
    const date = document.getElementById('anniversaryDate').value;
    const type = document.getElementById('anniversaryType').value;
    const remindBefore = parseInt(document.getElementById('anniversaryRemind').value);
    if (!name) { App.showToast('请输入名称', 'warning'); return; }
    if (!date) { App.showToast('请选择日期', 'warning'); return; }
    const annData = { id: id || Date.now().toString(36) + Math.random().toString(36).substr(2,6), name, date, type, remindBefore };
    if (id) { const ex = App.state.anniversaries.find(a => a.id === id); if (ex) annData.createdAt = ex.createdAt; }
    else annData.createdAt = new Date().toISOString();

    const anniversaries = [...App.state.anniversaries];
    if (id) { const idx = anniversaries.findIndex(a => a.id === id); if (idx !== -1) anniversaries[idx] = annData; }
    else anniversaries.push(annData);
    try {
      await window.electronAPI.saveAnniversaries(anniversaries);
      App.state.anniversaries = anniversaries;
      App.showToast(id ? '纪念日已更新' : '纪念日已添加', 'success');
      this.closeModal();
      this.render(document.getElementById('contentArea'));
    } catch (e) { App.showToast('保存失败: ' + e.message, 'error'); }
  },

  async deleteAnniversary(anniversaryId) {
    if (!anniversaryId) return;
    const ann = App.state.anniversaries.find(a => a.id === anniversaryId); if (!ann) return;
    if (!await App.showConfirm('删除纪念日', `确定删除"${ann.name}"吗？`)) return;
    App.state.anniversaries = App.state.anniversaries.filter(a => a.id !== anniversaryId);
    await window.electronAPI.saveAnniversaries(App.state.anniversaries);
    App.showToast('纪念日已删除', 'success');
    this.render(document.getElementById('contentArea'));
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const area = document.getElementById('contentArea');
  if (!area) return;
  area.addEventListener('click', (e) => AnniversaryModule.handleEvent(e));

  document.getElementById('anniversaryModalClose').addEventListener('click', () => AnniversaryModule.closeModal());
  document.getElementById('anniversaryModalCancel').addEventListener('click', () => AnniversaryModule.closeModal());
  document.getElementById('anniversaryModalSave').addEventListener('click', () => AnniversaryModule.saveAnniversary());
  document.getElementById('anniversaryModalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) AnniversaryModule.closeModal(); });
});
