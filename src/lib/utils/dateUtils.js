import { getWorkHoursPerDay } from './constants.js';

export function formatDate(date, format) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
    if (format === 'ddd') return dayNames[date.getDay()];
    if (format === 'MMM YYYY') return `${monthNames[date.getMonth()]} ${year}`;
    if (format === 'HH:mm') return `${hours}:${minutes}`;
    if (format === 'YYYY-MM-DD HH:mm') return `${year}-${month}-${day} ${hours}:${minutes}`;
    return date.toLocaleString();
}

export function generateCalendarDays(startDate, numDays, holidays) {
    const days = [];
    const currentDate = new Date(startDate);
    
    for (let i = 0; i < numDays; i++) {
        const date = new Date(currentDate);
        const dayOfWeek = date.getDay();
        const workHours = getWorkHoursPerDay(dayOfWeek);
        const isWeekend = workHours === 0;
        const isHoliday = holidays.includes(formatDate(date, 'YYYY-MM-DD'));
        const isBlocked = isWeekend || isHoliday;
        
        days.push({
            date,
            dayOfWeek,
            workHours,
            isBlocked,
            isToday: i === 0
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
}