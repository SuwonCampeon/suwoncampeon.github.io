/* ============================================
   todo.js — 할일 리스트 뷰 렌더링 & 모달 컨트롤러
   ============================================ */

const TodoView = (() => {

  // ── 상수 ──
  const PRIORITIES = [
    { key: 'high',   label: '🔴 높음', labelPctel: '★★★ 높음' },
    { key: 'medium', label: '🟡 보통', labelPctel: '★★ 보통' },
    { key: 'low',    label: '🔵 낮음', labelPctel: '★ 낮음' }
  ];

  const CATEGORIES = [
    { key: 'work',     emoji: '💼', label: '업무' },
    { key: 'study',    emoji: '📚', label: '학습' },
    { key: 'exercise', emoji: '🏃', label: '운동' },
    { key: 'life',     emoji: '🏠', label: '생활' }
  ];

  // ── DOM 참조 ──
  let _section = null;
  let _overlay = null;
  let _form = null;
  let _onTodoChange = null;

  // ── 필터 상태 ──
  let _currentFilter = 'all';

  /**
   * 초기화
   * @param {Function} onTodoChange - 할일 변경 시 콜백 (캘린더 갱신용)
   */
  function init(onTodoChange) {
    _onTodoChange = onTodoChange;
    _section = document.getElementById('todo-section');
    _overlay = document.getElementById('todo-modal-overlay');

    if (!_overlay) return;

    // 모달 닫기
    document.getElementById('btn-close-todo-modal').addEventListener('click', closeModal);
    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) closeModal();
    });

    // 폼 제출
    _form = document.getElementById('todo-form');
    _form.addEventListener('submit', (e) => {
      e.preventDefault();
      _handleSave();
    });

    // 우선순위 선택
    _overlay.querySelectorAll('.priority-option').forEach(opt => {
      opt.addEventListener('click', () => {
        _overlay.querySelectorAll('.priority-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    // 카테고리 선택
    _overlay.querySelectorAll('.category-option').forEach(opt => {
      opt.addEventListener('click', () => {
        _overlay.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
  }

  /**
   * 할일 목록을 렌더링한다.
   */
  function render() {
    if (!_section) return;

    const items = TodoManager.getAll(_currentFilter);
    const rate = TodoManager.getCompletionRate();

    // 오늘 날짜
    const today = _formatDate(new Date());

    _section.innerHTML = `
      <div class="todo-section__header">
        <div class="todo-section__title-row">
          <h2 class="todo-section__title">✅ 할일 목록</h2>
          <span class="todo-section__count">${rate.done}/${rate.total}</span>
        </div>
        ${rate.total > 0 ? `
          <div class="todo-progress">
            <div class="todo-progress__fill" style="width: ${rate.percent}%"></div>
          </div>
          <div class="todo-progress__text">${rate.percent}% 완료</div>
        ` : ''}
        <div class="todo-filters">
          <button class="todo-filter-btn ${_currentFilter === 'all' ? 'active' : ''}" data-filter="all">전체</button>
          <button class="todo-filter-btn ${_currentFilter === 'active' ? 'active' : ''}" data-filter="active">미완료</button>
          <button class="todo-filter-btn ${_currentFilter === 'done' ? 'active' : ''}" data-filter="done">완료</button>
        </div>
      </div>
      <div class="todo-list" id="todo-list-items"></div>
    `;

    // 필터 버튼 바인딩
    _section.querySelectorAll('.todo-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _currentFilter = btn.dataset.filter;
        render();
      });
    });

    const listEl = document.getElementById('todo-list-items');

    if (items.length === 0) {
      const emptyMsg = _currentFilter === 'all'
        ? '할일을 추가해보세요!'
        : _currentFilter === 'active'
          ? '미완료 할일이 없습니다 🎉'
          : '완료된 할일이 없습니다';

      listEl.innerHTML = `
        <div class="todo-empty">
          <div class="todo-empty__icon">${_currentFilter === 'active' ? '🎉' : '📋'}</div>
          <div class="todo-empty__text">${emptyMsg}</div>
        </div>
      `;
      return;
    }

    // 그룹 분리: 미완료 → 완료
    const activeItems = items.filter(i => !i.completed);
    const doneItems = items.filter(i => i.completed);

    let html = '';

    if (_currentFilter === 'all' || _currentFilter === 'active') {
      if (activeItems.length > 0 && _currentFilter === 'all') {
        html += `<div class="todo-group__title">진행 중 (${activeItems.length})</div>`;
      }
      activeItems.forEach(item => {
        html += _renderItem(item, today);
      });
    }

    if (_currentFilter === 'all' || _currentFilter === 'done') {
      if (doneItems.length > 0 && _currentFilter === 'all') {
        html += `<div class="todo-group__title">완료 (${doneItems.length})</div>`;
      }
      doneItems.forEach(item => {
        html += _renderItem(item, today);
      });
    }

    listEl.innerHTML = html;

    // 이벤트 바인딩
    _bindItemEvents(listEl);
  }

  /**
   * 할일 아이템 HTML 생성
   */
  function _renderItem(item, today) {
    const isOverdue = item.dueDate && item.dueDate < today && !item.completed;
    const cat = CATEGORIES.find(c => c.key === item.category);

    let dueDateLabel = '';
    if (item.dueDate) {
      const [y, m, d] = item.dueDate.split('-').map(Number);
      dueDateLabel = `${m}/${d}`;
      if (item.dueDate === today) dueDateLabel = '오늘';
    }

    return `
      <div class="todo-item ${item.completed ? 'todo-item--done' : ''}" data-id="${item.id}">
        <div class="todo-item__priority todo-item__priority--${item.priority || 'medium'}"></div>
        <div class="todo-item__check ${item.completed ? 'todo-item__check--checked' : ''}" data-action="toggle" data-id="${item.id}">
          <span class="todo-item__check-icon">✓</span>
        </div>
        <div class="todo-item__body">
          <div class="todo-item__title">${_escapeHTML(item.title)}</div>
          <div class="todo-item__meta">
            ${dueDateLabel ? `<span class="todo-item__due ${isOverdue ? 'todo-item__due--overdue' : ''}">${isOverdue ? '⚠ ' : ''}${dueDateLabel}</span>` : ''}
            ${cat ? `<span class="todo-item__category todo-item__category--${cat.key}">${cat.emoji} ${cat.label}</span>` : ''}
          </div>
        </div>
        <button class="todo-item__delete" data-action="delete" data-id="${item.id}" aria-label="삭제">×</button>
      </div>
    `;
  }

  /**
   * 할일 아이템 이벤트 바인딩
   */
  function _bindItemEvents(listEl) {
    // 체크박스 토글
    listEl.querySelectorAll('[data-action="toggle"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        TodoManager.toggleComplete(el.dataset.id);
        render();
        if (_onTodoChange) _onTodoChange();
      });
    });

    // 삭제 버튼
    listEl.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setTimeout(() => {
          if (confirm('이 할일을 삭제하시겠습니까?')) {
            TodoManager.removeItem(el.dataset.id);
            render();
            if (_onTodoChange) _onTodoChange();
          }
        }, 150);
      });
    });

    // 아이템 클릭 → 편집 모달
    listEl.querySelectorAll('.todo-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const items = TodoManager.getAll();
        const item = items.find(i => i.id === id);
        if (item) openModal(item);
      });
    });
  }

  /**
   * 할일 추가/편집 모달을 연다.
   * @param {Object|null} item - 기존 할일 (편집 시)
   */
  function openModal(item = null) {
    if (!_overlay) return;

    // 모달 제목
    const titleEl = document.getElementById('todo-modal-title');
    if (titleEl) titleEl.textContent = item ? '할일 편집' : '새 할일';

    // 폼 리셋
    const titleInput = document.getElementById('todo-title');
    const dueDateInput = document.getElementById('todo-duedate');
    const idInput = document.getElementById('todo-id');
    const deleteBtn = document.getElementById('btn-delete-todo');

    if (item) {
      idInput.value = item.id;
      titleInput.value = item.title;
      dueDateInput.value = item.dueDate || '';
      deleteBtn.style.display = 'block';

      // 우선순위
      _overlay.querySelectorAll('.priority-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.priority === item.priority);
      });

      // 카테고리
      _overlay.querySelectorAll('.category-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.category === item.category);
      });
    } else {
      idInput.value = '';
      titleInput.value = '';
      dueDateInput.value = '';
      deleteBtn.style.display = 'none';

      // 기본 우선순위: 보통
      _overlay.querySelectorAll('.priority-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.priority === 'medium');
      });

      // 카테고리 초기화
      _overlay.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
    }

    _overlay.setAttribute('aria-hidden', 'false');

    // 삭제 버튼 바인딩
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (item) {
        setTimeout(() => {
          if (confirm('이 할일을 삭제하시겠습니까?')) {
            TodoManager.removeItem(item.id);
            closeModal();
            render();
            if (_onTodoChange) _onTodoChange();
          }
        }, 150);
      }
    };
  }

  /** 모달을 닫는다. */
  function closeModal() {
    if (_overlay) _overlay.setAttribute('aria-hidden', 'true');
  }

  /** 저장 처리 */
  function _handleSave() {
    const title = document.getElementById('todo-title').value.trim();
    if (!title) {
      alert('할일 제목을 입력해주세요.');
      return;
    }

    const idInput = document.getElementById('todo-id');
    const dueDate = document.getElementById('todo-duedate').value || null;

    const selectedPriority = _overlay.querySelector('.priority-option.selected');
    const selectedCategory = _overlay.querySelector('.category-option.selected');

    const data = {
      title: title,
      dueDate: dueDate,
      priority: selectedPriority ? selectedPriority.dataset.priority : 'medium',
      category: selectedCategory ? selectedCategory.dataset.category : null
    };

    if (idInput.value) {
      // 편집
      TodoManager.updateItem(idInput.value, data);
    } else {
      // 추가
      TodoManager.addItem(data);
    }

    closeModal();
    render();
    if (_onTodoChange) _onTodoChange();
  }

  /** Date → YYYY-MM-DD */
  function _formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /** HTML 이스케이프 */
  function _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, render, openModal, closeModal };
})();
