/* ============================================
   shareConfig.js — 일정 공유 설정 모달 컨트롤러
   ============================================ */

const ShareConfig = (() => {
  let _overlay, _modal, _nicknameIn, _themeBtns, _btnShare, _btnClose;
  let _currentEvent = null;

  function init() {
    _overlay = document.getElementById('share-config-modal-overlay');
    _modal = document.getElementById('share-config-modal');
    _nicknameIn = document.getElementById('share-nickname');
    _themeBtns = document.querySelectorAll('.share-theme-btn');
    _btnShare = document.getElementById('btn-share-execute');
    _btnClose = document.getElementById('btn-close-share-modal');

    // 이벤트 리스너 바인딩
    if (_btnClose) {
      _btnClose.addEventListener('click', close);
    }
    
    if (_overlay) {
      _overlay.addEventListener('click', (e) => {
        if (e.target === _overlay) close();
      });
    }

    // 테마 선택 토글
    _themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        _themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 공유 실행 버튼
    if (_btnShare) {
      _btnShare.addEventListener('click', _executeShare);
    }
  }

  function open(evt) {
    if (!_overlay) init(); // DOM 요소가 늦게 로드되었을 경우 대비

    _currentEvent = evt;
    _nicknameIn.value = ''; // 모달 열 때 닉네임 초기화
    
    // 테마 초기화 (기본 빈티지)
    _themeBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('.share-theme-btn[data-share-theme="vintage"]').classList.add('active');

    _overlay.setAttribute('aria-hidden', 'false');
  }

  function close() {
    _overlay.setAttribute('aria-hidden', 'true');
    _currentEvent = null;
  }

  function _getTheme() {
    const activeBtn = Array.from(_themeBtns).find(btn => btn.classList.contains('active'));
    return activeBtn ? activeBtn.dataset.shareTheme : 'vintage';
  }

  async function _executeShare() {
    if (!_currentEvent) return;

    const nickname = _nicknameIn.value.trim() || '누군가';
    const theme = _getTheme();

    // 1. 공유할 데이터 최소화 및 객체 생성
    const shareData = {
      n: nickname,
      thm: theme,
      t: _currentEvent.title,
      d: _currentEvent.date,
      s: _currentEvent.startTime || '',
      e: _currentEvent.endTime || '',
      l: _currentEvent.location || '',
      ad: _currentEvent.allDay ? 1 : 0
    };

    // 2. Base64 인코딩 (한글 깨짐 방지를 위해 encodeURIComponent 사용)
    const jsonStr = JSON.stringify(shareData);
    const base64Str = btoa(encodeURIComponent(jsonStr));

    // 3. URL 생성
    // 현재 접속 주소를 기준으로 share.html 경로를 만듦
    const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '').replace(/\/$/, '');
    const shareUrl = `${baseUrl}/share.html?data=${base64Str}`;

    // 4. Web Share API 호출 (모바일 네이티브 공유)
    if (navigator.share) {
      try {
        await navigator.share({
          title: '특별한 일정 초대장이 도착했어요!',
          text: `${nickname}님이 일정을 공유했습니다.`,
          url: shareUrl
        });
        close();
      } catch (err) {
        // 사용자가 공유 창을 닫았거나 다른 에러 발생 시 Fallback으로 전환 (단, AbortError는 무시)
        if (err.name !== 'AbortError') {
          _fallbackCopy(shareUrl);
        }
      }
    } else {
      // 데스크탑 등 Web Share API를 지원하지 않는 경우
      _fallbackCopy(shareUrl);
    }
  }

  function _fallbackCopy(url) {
    navigator.clipboard.writeText(url).then(() => {
      // 자체 Toast 알림 생성
      _showToast('초대장 링크가 복사되었습니다!');
      close();
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
      alert('링크 복사에 실패했습니다.');
    });
  }

  function _showToast(msg) {
    let toast = document.getElementById('share-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'share-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      toast.style.color = '#fff';
      toast.style.padding = '10px 20px';
      toast.style.borderRadius = '20px';
      toast.style.zIndex = '10000';
      toast.style.fontSize = '0.9rem';
      toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transition = 'opacity 0.3s ease';

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  return { init, open, close };
})();
