/**
 * 坚果 - 便签模块
 * 使用事件委托处理便签创建、编辑、颜色切换、删除
 */
const NoteModule = {
  noteColors: [
    { name: 'yellow', label: '黄色', bg: '#fef3c7', color: '#92400e' },
    { name: 'blue', label: '蓝色', bg: '#dbeafe', color: '#1e40af' },
    { name: 'green', label: '绿色', bg: '#dcfce7', color: '#166534' },
    { name: 'pink', label: '粉色', bg: '#fce7f3', color: '#9d174d' },
    { name: 'purple', label: '紫色', bg: '#f3e8ff', color: '#6b21a8' },
    { name: 'white', label: '白色', bg: '#ffffff', color: '#374151' }
  ],

  handleEvent(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'new-note': e.preventDefault(); this.addNote(); break;
      case 'delete-note': e.preventDefault(); this.deleteNote(id); break;
    }
  },

  handleChange(e) {
    const sel = e.target.closest('[data-action="change-color"]');
    if (sel) { this.changeNoteColor(sel.dataset.id, sel.value); }
  },

  render(area) {
    const notes = App.state.notes;
    area.innerHTML = `
      <div class="note-module">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div><h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin:0;">便签</h2>
          <p style="font-size:12px;color:var(--text-tertiary);margin:4px 0 0;">快速记录，自动保存 · 共 ${notes.length} 个便签</p></div>
          <button class="btn btn-primary" data-action="new-note">+ 新建便签</button>
        </div>
        ${notes.length === 0 ? this.renderEmpty() : `<div class="notes-grid">${notes.map((n, i) => this.renderCard(n)).join('')}</div>`}
      </div>`;

    // 自动保存绑定
    document.querySelectorAll('.note-textarea').forEach(ta => {
      ta.addEventListener('input', App.debounce((e) => this.saveContent(e.target.dataset.id, e.target.value), 500));
    });
  },

  renderEmpty() {
    return `<div class="empty-state"><i>📝</i><div class="empty-state-title">还没有便签</div>
      <div class="empty-state-desc">点击"新建便签"记录你的想法</div></div>`;
  },

  renderCard(note) {
    const c = this.noteColors.find(x => x.name === (note.color || 'yellow')) || this.noteColors[0];
    return `
      <div class="note-card note-card-${note.color || 'yellow'}" style="background:${c.bg};color:${c.color};${note.color==='white'?'border:1px solid var(--border-color);':''}">
        <textarea class="note-textarea" data-id="${note.id}" style="color:${c.color};" placeholder="输入便签内容...">${this.esc(note.content || '')}</textarea>
        <div class="note-card-footer">
          <span style="font-size:11px;">${App.formatDate(note.updatedAt || note.createdAt)}</span>
          <div style="display:flex;gap:4px;">
            <select class="form-select" style="width:auto;font-size:11px;padding:2px 20px 2px 6px;" data-action="change-color" data-id="${note.id}">
              ${this.noteColors.map(x => `<option value="${x.name}" ${note.color===x.name?'selected':''}>${x.label}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-icon btn-sm" data-action="delete-note" data-id="${note.id}" title="删除" style="color:${c.color};">🗑</button>
          </div>
        </div>
      </div>`;
  },

  esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },

  async addNote() {
    const note = { id: Date.now().toString(36) + Math.random().toString(36).substr(2,6), content: '', color: 'yellow', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    App.state.notes.push(note);
    await window.electronAPI.saveNotes(App.state.notes);
    this.render(document.getElementById('contentArea'));
    App.showToast('便签已创建', 'success');
  },

  async saveContent(noteId, content) {
    const note = App.state.notes.find(n => n.id === noteId);
    if (note) { note.content = content; note.updatedAt = new Date().toISOString(); await window.electronAPI.saveNotes(App.state.notes); }
  },

  async changeNoteColor(noteId, color) {
    const note = App.state.notes.find(n => n.id === noteId);
    if (note) { note.color = color; note.updatedAt = new Date().toISOString(); await window.electronAPI.saveNotes(App.state.notes); this.render(document.getElementById('contentArea')); }
  },

  async deleteNote(noteId) {
    if (!noteId || !await App.showConfirm('删除便签', '确定要删除这个便签吗？')) return;
    App.state.notes = App.state.notes.filter(n => n.id !== noteId);
    await window.electronAPI.saveNotes(App.state.notes);
    App.showToast('便签已删除', 'success');
    this.render(document.getElementById('contentArea'));
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const area = document.getElementById('contentArea');
  if (!area) return;
  area.addEventListener('click', (e) => NoteModule.handleEvent(e));
  area.addEventListener('change', (e) => NoteModule.handleChange(e));
});
