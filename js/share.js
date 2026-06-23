/* ============================================
   share.js — 수신자용 초대장 페이지 로직
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const dataParam = urlParams.get('data');

  if (!dataParam) {
    document.getElementById('error-message').style.display = 'block';
    return;
  }

  let eventData = null;

  try {
    // 1. Base64 디코딩 (encodeURIComponent 역순 적용)
    const jsonStr = decodeURIComponent(atob(dataParam));
    eventData = JSON.parse(jsonStr);
  } catch (err) {
    console.error('데이터 파싱 오류:', err);
    document.getElementById('error-message').style.display = 'block';
    return;
  }

  // 2. 데이터가 정상이라면 UI 렌더링
  if (eventData) {
    _applyTheme(eventData.thm);
    _renderUI(eventData);
    _bindButtons(eventData);
    
    document.getElementById('invite-card').style.display = 'block';
    document.getElementById('promo-banner').style.display = 'block';
  }
});

function _applyTheme(theme) {
  // 테마 값이 'pctel'이면 전체 html 요소에 data-theme 설정
  if (theme === 'pctel') {
    document.documentElement.setAttribute('data-theme', 'pctel');
  } else {
    document.documentElement.setAttribute('data-theme', 'vintage');
  }
}

function _renderUI(data) {
  // 발신자 설정
  const senderEl = document.getElementById('display-sender');
  senderEl.textContent = `[ 보낸사람: ${data.n} ]`;

  // 제목 설정
  document.getElementById('display-title').textContent = data.t;

  // 날짜 포맷팅 (YYYY-MM-DD -> YYYY년 MM월 DD일 (요일))
  const dateObj = new Date(data.d);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const dateStr = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${weekdays[dateObj.getDay()]})`;
  document.getElementById('display-date').textContent = dateStr;

  // 시간 설정
  if (data.ad === 1) {
    document.getElementById('display-time').textContent = '종일';
  } else {
    document.getElementById('display-time').textContent = `${data.s} ~ ${data.e}`;
  }

  // 장소 설정
  const locationRow = document.getElementById('location-row');
  if (data.l) {
    document.getElementById('display-location').textContent = data.l;
    locationRow.style.display = 'flex';
  } else {
    locationRow.style.display = 'none';
  }
}

function _bindButtons(data) {
  const btnSamsung = document.getElementById('btn-add-samsung');
  const btnApple = document.getElementById('btn-add-apple');

  const downloadIcs = () => {
    _generateAndDownloadICS(data);
    _showToast('💡 다운로드된 파일을 터치하시면 스마트폰 캘린더에 일정이 자동으로 등록됩니다!');
  };

  btnSamsung.addEventListener('click', downloadIcs);
  btnApple.addEventListener('click', downloadIcs);
}

// ==============================
// ICS 파일 생성 및 다운로드
// ==============================
function _generateAndDownloadICS(data) {
  const dtStamp = _formatIcsDate(new Date(), true);
  
  let dtStart, dtEnd;
  const targetDate = new Date(data.d);
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');

  if (data.ad === 1) {
    // 종일 일정 (VALUE=DATE)
    dtStart = `VALUE=DATE:${year}${month}${day}`;
    // 종일 일정의 END는 다음날
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nYear = nextDate.getFullYear();
    const nMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nDay = String(nextDate.getDate()).padStart(2, '0');
    dtEnd = `VALUE=DATE:${nYear}${nMonth}${nDay}`;
  } else {
    // 시간 지정 일정 (현지 시간 기준)
    const [sHour, sMin] = data.s.split(':');
    const [eHour, eMin] = data.e.split(':');
    
    // 타임존을 강제로 지정하지 않으면 기기 기본 타임존을 따름 (플로팅 타임)
    dtStart = `TZID=Asia/Seoul:${year}${month}${day}T${sHour}${sMin}00`;
    dtEnd = `TZID=Asia/Seoul:${year}${month}${day}T${eHour}${eMin}00`;
  }

  // 줄바꿈 방지를 위한 문자열 접기 헬퍼 (ICS 스펙: 한 줄이 75바이트를 넘으면 안 됨)
  const fold = (line) => {
    return line.match(/.{1,75}/g).join('\r\n ');
  };

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RetroLab Calendar//KR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `DTSTAMP:${dtStamp}`,
    `DTSTART;${dtStart}`,
    `DTEND;${dtEnd}`,
    fold(`SUMMARY:${data.t}`),
    fold(`DESCRIPTION:${data.n}님이 RetroLab Calendar를 통해 공유한 일정입니다.`),
  ];

  if (data.l) {
    icsLines.push(fold(`LOCATION:${data.l}`));
  }

  icsLines.push('END:VEVENT');
  icsLines.push('END:VCALENDAR');

  const icsString = icsLines.join('\r\n');
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  
  // 파일 다운로드 트리거
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `invite_${year}${month}${day}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 날짜를 ICS 포맷(YYYYMMDDThhmmssZ)으로 변환
function _formatIcsDate(date, isUTC = false) {
  const pad = (n) => String(n).padStart(2, '0');
  if (isUTC) {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  }
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// 토스트 메시지 렌더링
function _showToast(msg) {
  let toast = document.getElementById('share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '40px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'var(--text-dark)';
    toast.style.color = 'var(--paper-warm)';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '24px';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '0.85rem';
    toast.style.fontWeight = 'bold';
    toast.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)';
    toast.style.textAlign = 'center';
    toast.style.width = '85%';
    toast.style.maxWidth = '300px';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transition = 'opacity 0.3s ease';

  // 기존 타이머 제거
  if (toast.dataset.timeoutId) {
    clearTimeout(Number(toast.dataset.timeoutId));
  }

  const timeoutId = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000); // 사용자가 충분히 읽을 수 있도록 4초 유지

  toast.dataset.timeoutId = timeoutId.toString();
}
