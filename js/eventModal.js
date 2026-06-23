/* ============================================
   eventModal.js — 일정 추가/편집 모달 컨트롤러
   ============================================ */

const EventModal = (() => {
  const COLORS = ['blue', 'green', 'orange', 'pink', 'purple', 'teal', 'red', 'gray', 'default'];
  
  // DOM
  let _overlay, _modal, _form, _titleIn, _alldayCb, _dateIn;
  let _startHrD, _startMinD, _endHrD, _endMinD; // digital
  let _locationIn, _colorIn, _colorPicker, _btnDelete, _idIn;

  let _onSaveCallback = null;
  let _onDeleteCallback = null;

  function init(onSave, onDelete) {
    _onSaveCallback = onSave;
    _onDeleteCallback = onDelete;

    _overlay = document.getElementById('event-modal-overlay');
    _modal = document.getElementById('event-modal');
    _form = document.getElementById('event-form');
    
    _idIn = document.getElementById('event-id');
    _titleIn = document.getElementById('event-title');
    _alldayCb = document.getElementById('event-allday');
    _dateIn = document.getElementById('event-date');
    _locationIn = document.getElementById('event-location');
    _colorIn = document.getElementById('event-color');
    _colorPicker = document.getElementById('event-color-picker');
    _btnDelete = document.getElementById('btn-delete-event');

    _startHrD = document.getElementById('event-start-time');
    _endHrD = document.getElementById('event-end-time');

    // Init Color Picker
    _initColorPicker();

    // Init Tumblers
    _initTumblers();

    // Event Listeners
    document.getElementById('btn-close-modal').addEventListener('click', close);
    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) close();
    });

    _alldayCb.addEventListener('change', () => {
      document.getElementById('time-picker-container').style.display = _alldayCb.checked ? 'none' : 'block';
    });

    _form.addEventListener('submit', (e) => {
      e.preventDefault();
      _handleSave();
    });

    _btnDelete.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => {
        if (confirm('정말로 이 일정을 삭제하시겠습니까?')) {
          _onDeleteCallback(_idIn.value);
          close();
        }
      }, 150); // 키보드 닫힘 등 화면 리사이즈 후 confirm이 뜨도록 지연
    });

    // 테마 변경에 따른 타임 피커 UI 토글 감지 (app.js에서 테마 바꿀 때 사용)
    // 현재는 CSS로 처리 중
  }

  function _initColorPicker() {
    _colorPicker.innerHTML = COLORS.map(c => `
      <div class="color-swatch ${c === 'blue' ? 'selected' : ''}" 
           style="background-color: var(--event-color-${c});" 
           data-color="${c}"></div>
    `).join('');

    _colorPicker.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        _colorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        e.target.classList.add('selected');
        _colorIn.value = e.target.dataset.color;
      });
    });
  }

  // --- Tumbler Logic ---
  const _tumblers = {};

  function _initTumblers() {
    _setupTumbler('tumbler-start-hour', 24);
    _setupTumbler('tumbler-start-minute', 60);
    _setupTumbler('tumbler-end-hour', 24);
    _setupTumbler('tumbler-end-minute', 60);
  }

  function _setupTumbler(id, max) {
    const el = document.getElementById(id);
    const track = document.createElement('div');
    track.className = 'tumbler-track';
    
    // Add items
    for (let i = 0; i < max; i++) {
      const item = document.createElement('div');
      item.className = 'tumbler-item';
      item.textContent = String(i).padStart(2, '0');
      track.appendChild(item);
    }
    el.appendChild(track);

    const itemHeight = 20;
    let currentY = 0;
    let startY = 0;
    let isDragging = false;
    let currentIndex = 0;

    _tumblers[id] = {
      el, track, max, itemHeight,
      getIndex: () => currentIndex,
      setIndex: (idx) => {
        currentIndex = Math.max(0, Math.min(idx, max - 1));
        currentY = -(currentIndex * itemHeight);
        track.style.transform = `translateY(${currentY + 20}px)`; // offset for center
        _updateTumblerActive(track, currentIndex);
      }
    };

    // Initial positioning
    _tumblers[id].setIndex(0);

    // Mouse/Touch events
    const onStart = (y) => {
      isDragging = true;
      startY = y - currentY;
      track.style.transition = 'none';
    };

    const onMove = (y) => {
      if (!isDragging) return;
      currentY = y - startY;
      track.style.transform = `translateY(${currentY + 20}px)`;
      const approxIdx = Math.max(0, Math.min(Math.round(-currentY / itemHeight), max - 1));
      _updateTumblerActive(track, approxIdx);
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      track.style.transition = 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      let targetIdx = Math.round(-currentY / itemHeight);
      _tumblers[id].setIndex(targetIdx);
    };

    el.addEventListener('mousedown', e => onStart(e.clientY));
    document.addEventListener('mousemove', e => onMove(e.clientY));
    document.addEventListener('mouseup', onEnd);

    el.addEventListener('touchstart', e => onStart(e.touches[0].clientY), {passive: true});
    document.addEventListener('touchmove', e => {
      if(isDragging && e.target.closest('.tumbler')) e.preventDefault();
      onMove(e.touches[0].clientY);
    }, {passive: false});
    document.addEventListener('touchend', onEnd);
  }

  function _updateTumblerActive(track, idx) {
    Array.from(track.children).forEach((child, i) => {
      child.classList.toggle('active', i === idx);
    });
  }

  function _getTumblerTime(prefix) {
    const h = String(_tumblers[`tumbler-${prefix}-hour`].getIndex()).padStart(2, '0');
    const m = String(_tumblers[`tumbler-${prefix}-minute`].getIndex()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function _setTumblerTime(prefix, timeStr) {
    if (!timeStr) {
      _tumblers[`tumbler-${prefix}-hour`].setIndex(0);
      _tumblers[`tumbler-${prefix}-minute`].setIndex(0);
      return;
    }
    const [h, m] = timeStr.split(':').map(Number);
    _tumblers[`tumbler-${prefix}-hour`].setIndex(h || 0);
    _tumblers[`tumbler-${prefix}-minute`].setIndex(m || 0);
  }

  // --- Public Methods ---

  function open(dateStr, existingEvent = null) {
    _form.reset();
    
    // Set Date
    _dateIn.value = dateStr;

    if (existingEvent) {
      // EDIT MODE
      document.getElementById('modal-title').textContent = '일정 편집';
      _btnDelete.style.display = 'block';
      
      _idIn.value = existingEvent.id;
      _titleIn.value = existingEvent.title;
      _locationIn.value = existingEvent.location || '';
      _alldayCb.checked = existingEvent.allDay;
      
      // Set Color
      const colorToSelect = existingEvent.color || 'blue';
      _colorIn.value = colorToSelect;
      _colorPicker.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('selected', s.dataset.color === colorToSelect);
      });

      // Set Time
      if (!existingEvent.allDay) {
        _startHrD.value = existingEvent.startTime;
        _endHrD.value = existingEvent.endTime;
        _setTumblerTime('start', existingEvent.startTime);
        _setTumblerTime('end', existingEvent.endTime);
      } else {
        _setTumblerTime('start', '12:00');
        _setTumblerTime('end', '13:00');
      }

    } else {
      // ADD MODE
      document.getElementById('modal-title').textContent = '새 일정';
      _btnDelete.style.display = 'none';
      _idIn.value = '';
      _alldayCb.checked = false;
      
      // Default color: blue
      _colorIn.value = 'blue';
      _colorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      _colorPicker.querySelector('[data-color="blue"]').classList.add('selected');

      // Default time: now ~ now + 1hr (rounded to hour)
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const h1 = String(now.getHours()).padStart(2, '0');
      now.setHours(now.getHours() + 1);
      const h2 = String(now.getHours()).padStart(2, '0');

      _startHrD.value = `${h1}:00`;
      _endHrD.value = `${h2}:00`;
      _setTumblerTime('start', `${h1}:00`);
      _setTumblerTime('end', `${h2}:00`);
    }

    document.getElementById('time-picker-container').style.display = _alldayCb.checked ? 'none' : 'block';
    
    _overlay.setAttribute('aria-hidden', 'false');
  }

  function close() {
    _overlay.setAttribute('aria-hidden', 'true');
  }

  function _handleSave() {
    const isPctel = document.documentElement.getAttribute('data-theme') === 'pctel';
    
    const isAllDay = _alldayCb.checked;
    let startTime = null;
    let endTime = null;

    if (!isAllDay) {
      if (isPctel) {
        startTime = _startHrD.value || '12:00';
        endTime = _endHrD.value || '13:00';
      } else {
        startTime = _getTumblerTime('start');
        endTime = _getTumblerTime('end');
      }
    }

    const eventData = {
      id: _idIn.value || `local-${Date.now()}`,
      title: _titleIn.value.trim(),
      date: _dateIn.value,
      startTime: startTime,
      endTime: endTime,
      location: _locationIn.value.trim() || null,
      color: _colorIn.value,
      allDay: isAllDay
    };

    _onSaveCallback(eventData, !!_idIn.value);
    close();
  }

  return { init, open, close };
})();
