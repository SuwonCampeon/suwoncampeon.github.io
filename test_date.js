const gEvent = {
  start: { date: '2026-06-01' },
  end: { date: '2026-06-04' }
};

const startDate = new Date(gEvent.start.date);
const endDate   = new Date(gEvent.end.date);
const events = [];

const current = new Date(startDate);
const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
let dayCount = 0;

while (current < endDate) {
  let multiDayState = 'single';
  if (totalDays > 1) {
    if (dayCount === 0) multiDayState = 'start';
    else if (dayCount === totalDays - 1) multiDayState = 'end';
    else multiDayState = 'middle';
  }
  
  function _formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  events.push({
    date: _formatDate(current),
    multiDayState: multiDayState
  });
  current.setDate(current.getDate() + 1);
  dayCount++;
}

console.log(events);
