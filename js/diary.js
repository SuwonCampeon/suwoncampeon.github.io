/* ============================================
   diary.js — 일기장 뷰 렌더링 & 모달 컨트롤러
   ============================================ */

const DiaryView = (() => {

  // ── 상수 ──
  const MOODS = [
    { key: 'happy',    emoji: '😊', label: '좋음' },
    { key: 'neutral',  emoji: '😐', label: '보통' },
    { key: 'sad',      emoji: '😢', label: '슬픔' },
    { key: 'angry',    emoji: '😡', label: '화남' },
    { key: 'sleepy',   emoji: '😴', label: '졸림' },
    { key: 'thinking', emoji: '🤔', label: '생각' },
    { key: 'love',     emoji: '🥰', label: '사랑' },
    { key: 'excited',  emoji: '🤩', label: '신남' }
  ];

  const WEATHERS = [
    { key: 'sunny',      emoji: '☀️', label: '맑음' },
    { key: 'cloudy-sun', emoji: '⛅', label: '구름 조금' },
    { key: 'cloudy',     emoji: '☁️', label: '흐림' },
    { key: 'rainy',      emoji: '🌧️', label: '비' },
    { key: 'snowy',      emoji: '❄️', label: '눈' },
    { key: 'windy',      emoji: '🌬️', label: '바람' }
  ];

  // ── DOM 참조 ──
  let _section = null;
  let _overlay = null;
  let _form = null;
  let _onDiaryChange = null;

  // ── 현재 표시 중인 날짜 ──
  let _currentDate = '';

  /**
   * 초기화
   * @param {Function} onDiaryChange - 일기 변경 시 콜백 (캘린더 갱신용)
   */
  function init(onDiaryChange) {
    _onDiaryChange = onDiaryChange;
    _section = document.getElementById('diary-section');
    _overlay = document.getElementById('diary-modal-overlay');

    if (!_overlay) return;

    // 모달 닫기
    document.getElementById('btn-close-diary-modal').addEventListener('click', closeEditor);
    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) closeEditor();
    });

    // 폼 제출
    _form = document.getElementById('diary-form');
    _form.addEventListener('submit', (e) => {
      e.preventDefault();
      _handleSave();
    });

    // 기분 선택
    _overlay.querySelectorAll('.mood-option').forEach(opt => {
      opt.addEventListener('click', () => {
        _overlay.querySelectorAll('.mood-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    // 날씨 선택
    _overlay.querySelectorAll('.weather-option').forEach(opt => {
      opt.addEventListener('click', () => {
        _overlay.querySelectorAll('.weather-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    // 사진 추가 버튼
    const photoAddBtn = document.getElementById('diary-photo-add-btn');
    const photoInput = document.getElementById('diary-photo-input');
    if (photoAddBtn && photoInput) {
      photoAddBtn.addEventListener('click', () => photoInput.click());
      photoInput.addEventListener('change', _handlePhotoSelect);
    }
  }

  /**
   * 선택된 날짜의 일기를 렌더링한다.
   * @param {string} dateStr - YYYY-MM-DD
   */
  function render(dateStr) {
    _currentDate = dateStr;
    if (!_section) return;

    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const dateLabel = `${m}월 ${d}일 ${dayNames[date.getDay()]}`;

    const entry = DiaryManager.getEntryByDate(dateStr);

    if (entry) {
      _renderEntry(entry, dateLabel);
    } else {
      _renderEmpty(dateLabel);
    }
  }

  /**
   * 일기가 있을 때 렌더링
   */
  function _renderEntry(entry, dateLabel) {
    const moodInfo = MOODS.find(m => m.key === entry.mood) || { emoji: '', label: '' };
    const weatherInfo = WEATHERS.find(w => w.key === entry.weather) || { emoji: '', label: '' };

    const photosHTML = entry.photos && entry.photos.length > 0
      ? `<div class="diary-card__photos">
          ${entry.photos.map(p => `
            <div class="diary-card__photo">
              <img src="${p}" alt="일기 사진" loading="lazy">
            </div>
          `).join('')}
         </div>`
      : '';

    _section.innerHTML = `
      <div class="diary-card">
        <div class="diary-card__meta">
          ${moodInfo.emoji ? `<span class="diary-card__mood">
            <span class="diary-card__mood-emoji">${moodInfo.emoji}</span>
            ${moodInfo.label}
          </span>` : ''}
          ${weatherInfo.emoji ? `<span class="diary-card__weather">
            <span class="diary-card__weather-emoji">${weatherInfo.emoji}</span>
            ${weatherInfo.label}
          </span>` : ''}
        </div>
        <div class="diary-card__content">${_escapeHTML(entry.content || '')}</div>
        ${photosHTML}
        <div class="diary-card__actions">
          <button class="diary-action-btn" id="btn-edit-diary">✏️ 편집</button>
          <button class="diary-action-btn diary-action-btn--delete" id="btn-delete-diary">🗑️ 삭제</button>
        </div>
      </div>
    `;

    // 편집 버튼
    document.getElementById('btn-edit-diary').addEventListener('click', () => {
      openEditor(_currentDate, entry);
    });

    // 삭제 버튼
    document.getElementById('btn-delete-diary').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => {
        if (confirm('이 일기를 삭제하시겠습니까?')) {
          DiaryManager.deleteEntry(_currentDate);
          render(_currentDate);
          if (_onDiaryChange) _onDiaryChange();
        }
      }, 150);
    });
  }

  /**
   * 일기가 없을 때 빈 상태 렌더링
   */
  function _renderEmpty(dateLabel) {
    _section.innerHTML = `
      <div class="diary-empty">
        <div class="diary-empty__icon">📝</div>
        <div class="diary-empty__text">아직 일기가 없어요.<br>오늘 하루를 기록해보세요!</div>
        <button class="diary-empty__cta" id="btn-write-diary">일기 쓰기</button>
      </div>
    `;

    document.getElementById('btn-write-diary').addEventListener('click', () => {
      openEditor(_currentDate);
    });
  }

  /**
   * 일기 작성/편집 모달을 연다.
   * @param {string} dateStr - YYYY-MM-DD
   * @param {Object|null} entry - 기존 일기 (편집 시)
   */
  function openEditor(dateStr, entry = null) {
    if (!_overlay) return;

    _currentDate = dateStr;

    // 날짜 표시
    const dateDisplay = document.getElementById('diary-modal-date');
    if (dateDisplay) dateDisplay.value = dateStr;

    // 모달 제목
    const titleEl = document.getElementById('diary-modal-title');
    if (titleEl) titleEl.textContent = entry ? '일기 편집' : '일기 쓰기';

    // 내용
    const textarea = document.getElementById('diary-content');
    if (textarea) textarea.value = entry ? (entry.content || '') : '';

    // 기분 선택
    _overlay.querySelectorAll('.mood-option').forEach(opt => {
      opt.classList.toggle('selected', entry && opt.dataset.mood === entry.mood);
    });

    // 날씨 선택
    _overlay.querySelectorAll('.weather-option').forEach(opt => {
      opt.classList.toggle('selected', entry && opt.dataset.weather === entry.weather);
    });

    // 사진 미리보기 초기화
    _renderPhotoPreview(entry ? (entry.photos || []) : []);

    _overlay.setAttribute('aria-hidden', 'false');
  }

  /** 모달을 닫는다. */
  function closeEditor() {
    if (_overlay) _overlay.setAttribute('aria-hidden', 'true');
  }

  /** 저장 처리 */
  function _handleSave() {
    const content = document.getElementById('diary-content').value.trim();
    if (!content) {
      alert('일기 내용을 입력해주세요.');
      return;
    }

    const selectedMood = _overlay.querySelector('.mood-option.selected');
    const selectedWeather = _overlay.querySelector('.weather-option.selected');

    // 사진 수집
    const photos = [];
    _overlay.querySelectorAll('.diary-modal__photo-preview img').forEach(img => {
      photos.push(img.src);
    });

    const entry = {
      date: _currentDate,
      mood: selectedMood ? selectedMood.dataset.mood : 'neutral',
      weather: selectedWeather ? selectedWeather.dataset.weather : 'sunny',
      content: content,
      photos: photos
    };

    DiaryManager.saveEntry(entry);
    closeEditor();
    render(_currentDate);
    if (_onDiaryChange) _onDiaryChange();
  }

  /** 사진 선택 핸들러 */
  function _handlePhotoSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const existingPhotos = _overlay.querySelectorAll('.diary-modal__photo-preview').length;
    const maxPhotos = 3;

    for (let i = 0; i < files.length && (existingPhotos + i) < maxPhotos; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onload = (ev) => {
        // 이미지 리사이즈 (최대 300px)
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 300;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
            else { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

          // 현재 미리보기에 추가
          const currentPhotos = [];
          _overlay.querySelectorAll('.diary-modal__photo-preview img').forEach(el => {
            currentPhotos.push(el.src);
          });
          currentPhotos.push(dataUrl);
          _renderPhotoPreview(currentPhotos);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }

    // input 초기화
    e.target.value = '';
  }

  /** 사진 미리보기 렌더링 */
  function _renderPhotoPreview(photos) {
    const container = document.getElementById('diary-photo-previews');
    if (!container) return;

    container.innerHTML = '';

    photos.forEach((src, idx) => {
      const preview = document.createElement('div');
      preview.className = 'diary-modal__photo-preview';
      preview.innerHTML = `
        <img src="${src}" alt="사진 ${idx + 1}">
        <button class="diary-modal__photo-remove" data-idx="${idx}">×</button>
      `;
      container.appendChild(preview);
    });

    // 추가 버튼 (최대 3장)
    const addBtn = document.getElementById('diary-photo-add-btn');
    if (addBtn) {
      addBtn.style.display = photos.length >= 3 ? 'none' : 'flex';
    }

    // 삭제 버튼 바인딩
    container.querySelectorAll('.diary-modal__photo-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const current = [];
        container.querySelectorAll('.diary-modal__photo-preview img').forEach(el => current.push(el.src));
        current.splice(idx, 1);
        _renderPhotoPreview(current);
      });
    });
  }

  /** HTML 이스케이프 */
  function _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, render, openEditor, closeEditor };
})();
