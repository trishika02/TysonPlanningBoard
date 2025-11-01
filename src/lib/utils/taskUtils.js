import { CONFIG } from './constants.js';
import { formatDate } from './dateUtils.js';

export function getPixelOffsetForDate(date, calendarDays) {
    const dateObj = new Date(date);
    const dateStr = formatDate(dateObj, 'YYYY-MM-DD');
    const dayIndex = calendarDays.findIndex(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
    
    if (dayIndex === -1) return null;

    const day = calendarDays[dayIndex];
    
    if (day.isBlocked || day.workHours === 0) {
        return dayIndex * CONFIG.DAY_COLUMN_WIDTH;
    }

    const totalWorkMinutes = day.workHours * 60;
    const dayWorkStart = new Date(day.date);
    dayWorkStart.setHours(CONFIG.START_HOUR, 0, 0, 0);

    const dayWorkEnd = new Date(dayWorkStart.getTime() + day.workHours * 60 * 60000);
    const effectiveTime = new Date(Math.max(dayWorkStart.getTime(), Math.min(dayWorkEnd.getTime(), dateObj.getTime())));

    let taskOffsetMinutes = (effectiveTime.getTime() - dayWorkStart.getTime()) / (1000 * 60);
    const leftPercent = (taskOffsetMinutes / totalWorkMinutes);
    const leftPixelOffset = leftPercent * CONFIG.DAY_COLUMN_WIDTH;

    return (dayIndex * CONFIG.DAY_COLUMN_WIDTH) + leftPixelOffset;
}

export function calculateTaskDuration(taskStart, taskEnd, calendarDays) {
    let duration = 0;
    let tempDate = new Date(taskStart);
    tempDate.setHours(0, 0, 0, 0);
    
    while (tempDate < taskEnd) {
        const dateStr = formatDate(tempDate, 'YYYY-MM-DD');
        const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

        if (day && !day.isBlocked && day.workHours > 0) {
            const dayWorkStart = new Date(day.date);
            dayWorkStart.setHours(CONFIG.START_HOUR, 0, 0, 0);
            const dayWorkEnd = new Date(dayWorkStart.getTime() + day.workHours * 60 * 60000);

            const segmentStart = new Date(Math.max(taskStart.getTime(), dayWorkStart.getTime()));
            const segmentEnd = new Date(Math.min(taskEnd.getTime(), dayWorkEnd.getTime()));

            if (segmentEnd > segmentStart) {
                duration += (segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60);
            }
        }
        
        tempDate.setDate(tempDate.getDate() + 1);
    }
    
    return duration;
}

export function calculateNewEndDate(newStartDate, workDurationMinutes, calendarDays) {
    let minutesToDistribute = workDurationMinutes;
    let newEndDate = new Date(newStartDate);
    let dateStr = formatDate(newStartDate, 'YYYY-MM-DD');
    let currentDayIndex = calendarDays.findIndex(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

    if (currentDayIndex === -1) return newStartDate;

    while (minutesToDistribute > 0 && currentDayIndex < calendarDays.length) {
        const currentDay = calendarDays[currentDayIndex];
        
        if (!currentDay.isBlocked && currentDay.workHours > 0) {
            const dayWorkStart = new Date(currentDay.date);
            dayWorkStart.setHours(CONFIG.START_HOUR, 0, 0, 0);
            
            const dayWorkEnd = new Date(dayWorkStart.getTime() + currentDay.workHours * 60 * 60000);
            const calcStart = new Date(Math.max(newEndDate.getTime(), dayWorkStart.getTime()));

            let minutesAvailable = (dayWorkEnd.getTime() - calcStart.getTime()) / (1000 * 60);
            
            if (minutesAvailable <= 0) {
                currentDayIndex++;
                if (currentDayIndex < calendarDays.length) {
                    newEndDate = new Date(calendarDays[currentDayIndex].date);
                    newEndDate.setHours(CONFIG.START_HOUR, 0, 0, 0);
                }
                continue;
            }

            if (minutesToDistribute <= minutesAvailable) {
                newEndDate = new Date(calcStart.getTime() + minutesToDistribute * 60000);
                minutesToDistribute = 0;
            } else {
                minutesToDistribute -= minutesAvailable;
                newEndDate = new Date(dayWorkEnd);
                currentDayIndex++;
            }
        } else {
            currentDayIndex++;
            if (currentDayIndex < calendarDays.length) {
                newEndDate = new Date(calendarDays[currentDayIndex].date);
                newEndDate.setHours(CONFIG.START_HOUR, 0, 0, 0);
            }
        }
    }
    return newEndDate;
}

export function isOverlapping(taskIdToIgnore, lineId, newStart, newEnd, tasks) {
    const tasksOnLine = tasks.filter(t => t.lineId === lineId && t.id !== taskIdToIgnore);
    
    for (const task of tasksOnLine) {
        const existingStart = new Date(task.start);
        const existingEnd = new Date(task.end);

        if (newStart < existingEnd && newEnd > existingStart) {
            return true;
        }
    }
    return false;
}