/* ============================================
   calendar.js — 달력 렌더링 엔진
   날짜 계산, 그리드 생성, 3D 모션 전환
   ============================================ */

const CalendarRenderer = (() => {

  // ── 상수 ──
  const WEEKDAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];
  const MONTHS_KR = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  // ── DOM 참조 (init 시 바인딩) ──
  let _els = {};

  // ── 상태 ──
  let _currentYear   = 0;
  let _currentMonth  = 0;    // 0~11
  let _selectedDate  = '';   // YYYY-MM-DD
  let _onDateSelect  = null; // 콜백
  let _isAnimating   = false;// 애니메이션 중 중복 방지

  /**
   * 초기화
   * @param {Object}   elements     - { yearEl, monthEl, grid }
   * @param {Function} onDateSelect - 날짜 선택 시 콜백
   */
  function init(elements, onDateSelect) {
    _els = elements;
    _onDateSelect = onDateSelect;

    const now = new Date();
    _currentYear  = now.getFullYear();
    _currentMonth = now.getMonth();
    _selectedDate = _formatDate(now);

    _renderWeekdayRow();
    renderMonth(_currentYear, _currentMonth, null, null);
  }

  /**
   * 월간 달력 렌더링
   * @param {number}      year
   * @param {number}      month     - 0~11
   * @param {string|null} direction - 'left' | 'right' (방향)
   * @param {string|null} mode      - 'cube' | 'door' (애니메이션 종류)
   */
  function renderMonth(year, month, direction, mode) {
    _currentYear  = year;
    _currentMonth = month;

    _els.yearEl.textContent  = `${year}`;
    _els.monthEl.textContent = MONTHS_KR[month];

    if (!direction || !mode || _isAnimating) {
      // 애니메이션 없이 바로 렌더링
      _swapGrid(_buildGrid(year, month));
      return;
    }

    _isAnimating = true;
    const oldGrid = _els.grid;
    const newGrid = _buildGrid(year, month);
    const ANIM_MS = 420;

    // 애니메이션 클래스 접두어
    const prefix = mode === 'door' ? 'door' : mode === 'typewriter' ? 'typewriter' : 'cube';

    // 새 그리드를 DOM에 삽입 (아직 off-screen 준비)
    newGrid.style.opacity = '0';
    newGrid.style.position = 'absolute';
    newGrid.style.top = '0';
    newGrid.style.left = '0';
    newGrid.style.width = '100%';
    oldGrid.parentNode.appendChild(newGrid);

    // out 애니메이션 (현재 그리드)
    const outClass = `date-grid--${prefix}-out-${direction}`;
    oldGrid.classList.add(outClass);

    // ── 타이밍 분기 ──
    // 큐브: in/out 동시에 → delay 0ms (두 면이 붙어 공전하는 효과)
    // 회전문: 새 문이 열리기 시작 타이밍 = 40% 지점
    // 타이핑: in/out 동시 (구 그리드는 css에서 즉시 숨김)
    const inDelay = (mode === 'cube' || mode === 'typewriter') ? 0 : ANIM_MS * 0.4;

    setTimeout(() => {
      newGrid.style.opacity = '';
      newGrid.style.position = '';
      newGrid.style.top = '';
      newGrid.style.left = '';
      newGrid.style.width = '';

      const inClass = `date-grid--${prefix}-in-${direction}`;
      newGrid.classList.add(inClass);

      oldGrid.remove();
      _els.grid = newGrid;

      setTimeout(() => {
        newGrid.classList.remove(inClass);
        _isAnimating = false;
      }, ANIM_MS);

    }, inDelay);
  }

  /** 이전 달로 이동 */
  function prevMonth(mode) {
    let m = _currentMonth - 1;
    let y = _currentYear;
    if (m < 0) { m = 11; y--; }
    renderMonth(y, m, 'right', mode || null);
  }

  /** 다음 달로 이동 */
  function nextMonth(mode) {
    let m = _currentMonth + 1;
    let y = _currentYear;
    if (m > 11) { m = 0; y++; }
    renderMonth(y, m, 'left', mode || null);
  }

  /** 오늘로 이동 */
  function goToToday() {
    const now = new Date();
    _currentYear  = now.getFullYear();
    _currentMonth = now.getMonth();
    _selectedDate = _formatDate(now);
    renderMonth(_currentYear, _currentMonth, null, null);
    if (_onDateSelect) _onDateSelect(_selectedDate);
  }

  /** 현재 선택된 날짜 반환 */
  function getSelectedDate() {
    return _selectedDate;
  }

  /** 현재 표시 중인 년/월 반환 */
  function getCurrentMonth() {
    return { year: _currentYear, month: _currentMonth };
  }

  // ── 내부 함수 ──

  /** 요일 행 렌더링 (한 번만) */
  function _renderWeekdayRow() {
    const row = document.getElementById('weekday-row');
    if (!row) return;
    row.innerHTML = WEEKDAYS_KR.map((day, i) => {
      let mod = '';
      if (i === 0) mod = ' weekday-row__cell--sunday';
      if (i === 6) mod = ' weekday-row__cell--saturday';
      return `<div class="weekday-row__cell${mod}">${day}</div>`;
    }).join('');
  }

  /**
   * 새 그리드 DOM 요소를 생성하고 반환한다.
   * (실제 DOM 교체는 호출자가 처리)
   */
  function _buildGrid(year, month) {
    const cells   = _buildDateCells(year, month);
    const eventsMap = DataManager.getEventsMapForMonth(year, month);

    const grid = document.createElement('div');
    grid.className = 'date-grid';
    grid.id        = 'date-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', '월간 달력');

    const fragment = document.createDocumentFragment();
    cells.forEach((cell, idx) => {
      const el = _createCellElement(cell, eventsMap);
      el.style.setProperty('--cell-idx', idx);
      fragment.appendChild(el);
    });
    grid.appendChild(fragment);

    return grid;
  }

  /** 현재 그리드를 새 그리드로 애니메이션 없이 교체 */
  function _swapGrid(newGrid) {
    _els.grid.replaceWith(newGrid);
    _els.grid = newGrid;
  }

  /**
   * 해당 월의 날짜 셀 배열 생성 (이전/이번/다음 달 포함, 총 42칸)
   */
  function _buildDateCells(year, month) {
    const cells = [];
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays    = new Date(year, month, 0).getDate();

    // 이전 달
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      const py = month === 0 ? year - 1 : year;
      const pm = month === 0 ? 11 : month - 1;
      cells.push({ day: d, dateStr: _formatDateParts(py, pm, d), isOtherMonth: true, dayOfWeek: cells.length % 7 });
    }

    // 이번 달
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateStr: _formatDateParts(year, month, d), isOtherMonth: false, dayOfWeek: cells.length % 7 });
    }

    // 다음 달
    const remaining = 42 - cells.length;
    const ny = month === 11 ? year + 1 : year;
    const nm = month === 11 ? 0 : month + 1;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, dateStr: _formatDateParts(ny, nm, d), isOtherMonth: true, dayOfWeek: cells.length % 7 });
    }

    return cells;
  }

  /** 색상 기반 이벤트 분류 (사용자가 직접 칠한 색상에 따라 효과 부여) */
  function _categorizeEventByColor(color) {
    if (['red', 'pink', 'blue', 'purple'].includes(color)) return 'pin';
    if (['green', 'teal'].includes(color)) return 'stamp';
    if (['orange'].includes(color)) return 'sticker';
    return 'hole'; // gray, default 등
  }

  /** 셀 DOM 요소 생성 */
  function _createCellElement(cell, eventsMap) {
    const el = document.createElement('div');
    el.className = 'date-cell';
    el.dataset.date = cell.dateStr;

    if (cell.isOtherMonth)                    el.classList.add('date-cell--other-month');
    if (cell.dayOfWeek === 0)                 el.classList.add('date-cell--sunday');
    if (cell.dayOfWeek === 6)                 el.classList.add('date-cell--saturday');
    if (cell.dateStr === _formatDate(new Date())) el.classList.add('date-cell--today');
    if (cell.dateStr === _selectedDate)       el.classList.add('date-cell--selected');

    // 날짜 숫자
    const numEl = document.createElement('span');
    numEl.className = 'date-cell__number';
    numEl.textContent = cell.day;
    el.appendChild(numEl);

    // 일정 아날로그 인디케이터 & 하이라이터
    const events = eventsMap.get(cell.dateStr);
    if (events && events.length > 0) {
      // 하이라이터 컨테이너
      const highlightersEl = document.createElement('div');
      highlightersEl.className = 'date-cell__highlighters';
      el.appendChild(highlightersEl);

      let analogCount = 0;

      events.forEach((evt, idx) => {
        const state = evt.multiDayState || 'single';

        // 1. 형광펜 효과 (멀티데이 일정인 경우)
        if (state !== 'single') {
          const highlighter = document.createElement('div');
          highlighter.className = `highlighter-bar highlighter-bar--${state}`;
          highlighter.style.backgroundColor = `var(--event-color-${evt.color})`;
          highlightersEl.appendChild(highlighter);
        }

        // 2. 아날로그 인디케이터 (단일 일정, 또는 멀티데이 시작일이고 최대 2개 이하일 때)
        if ((state === 'single' || state === 'start') && analogCount < 2) {
          const type = _categorizeEventByColor(evt.color);
          const indicator = document.createElement('div');
          indicator.style.setProperty('--ind-color', `var(--event-color-${evt.color})`);
          
          if (type === 'pin') {
            indicator.className = `indicator-pin`;
            indicator.style.background = `radial-gradient(circle at 30% 30%, #fff 10%, var(--event-color-${evt.color}) 80%, rgba(0,0,0,0.5) 120%)`;
          } else if (type === 'sticker') {
            indicator.className = `indicator-sticker`;
            indicator.style.borderTopColor = `var(--event-color-${evt.color})`;
            indicator.style.transform = `rotate(${analogCount === 0 ? '-4deg' : '3deg'})`;
          } else if (type === 'stamp') {
            indicator.className = `indicator-stamp`;
            indicator.textContent = '!';
            indicator.style.color = `var(--event-color-${evt.color})`;
            indicator.style.borderColor = `var(--event-color-${evt.color})`;
            indicator.style.transform = `rotate(${analogCount === 0 ? '-12deg' : '10deg'})`;
          } else {
            indicator.className = `indicator-hole`;
          }
          
          el.appendChild(indicator);
          analogCount++;
        }
      });
    }

    // 일기 인디케이터
    if (typeof DiaryManager !== 'undefined' && DiaryManager.hasEntry(cell.dateStr)) {
      const diaryDot = document.createElement('div');
      diaryDot.className = 'date-cell__diary-dot';
      diaryDot.textContent = '📔';
      diaryDot.setAttribute('aria-label', '일기 있음');
      el.appendChild(diaryDot);
    }

    // 할일 인디케이터
    if (typeof TodoManager !== 'undefined') {
      const todos = TodoManager.getByDueDate(cell.dateStr);
      if (todos.length > 0) {
        const allDone = todos.every(t => t.completed);
        const todoDot = document.createElement('div');
        todoDot.className = 'date-cell__todo-dot';
        todoDot.textContent = allDone ? '✅' : '📝';
        todoDot.setAttribute('aria-label', allDone ? '할일 모두 완료' : '할일 있음');
        el.appendChild(todoDot);
      }
    }

    el.addEventListener('click', () => _selectDate(cell.dateStr));
    return el;
  }

  /** 날짜 선택 처리 */
  function _selectDate(dateStr) {
    const prevSelected = document.querySelector('.date-cell--selected');
    if (prevSelected) prevSelected.classList.remove('date-cell--selected');

    _selectedDate = dateStr;
    const target = document.querySelector(`[data-date="${dateStr}"]`);
    if (target) target.classList.add('date-cell--selected');

    if (_onDateSelect) _onDateSelect(dateStr);
  }

  /** Date → YYYY-MM-DD */
  function _formatDate(date) {
    return _formatDateParts(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /** (year, month 0~11, day) → YYYY-MM-DD */
  function _formatDateParts(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /** 외부에서 특정 날짜로 이동하기 위한 인터페이스 */
  function setDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y !== _currentYear || m - 1 !== _currentMonth) {
      renderMonth(y, m - 1, null, null);
    }
    _selectDate(dateStr);
  }

  return { init, renderMonth, prevMonth, nextMonth, goToToday, getSelectedDate, getCurrentMonth, setDate };

})();
