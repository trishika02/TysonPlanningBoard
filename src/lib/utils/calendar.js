// D:\Tyson\src\lib\utils\calendar.js

// === 1. Config Functions ===

// 0 = Sunday, 1 = Monday, ..., 6 = Saturday
export function getWorkHoursPerDay(dayOfWeek) {
    switch (dayOfWeek) {
        case 0: return 0; // Sunday (Weekend)
        case 5: return 8; // Friday (Shorter day)
        case 6: return 0; // Saturday (Weekend)
        default: return 10; // Weekday (Mon-Thurs)
    }
}

// === 2. Date Formatting ===

export function formatDate(date, format) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (format === 'YYYY-MM-DD') {
        return `${year}-${month}-${day}`;
    }
    if (format === 'ddd') {
        return dayNames[date.getDay()];
    }
    if (format === 'MMM YYYY') {
        return `${monthNames[date.getMonth()]} ${year}`;
    }
    if (format === 'HH:mm') {
        return `${hours}:${minutes}`;
    }
    if (format === 'YYYY-MM-DD HH:mm') {
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    return date.toLocaleString();
}

// === 3. Core Calculation Logic ===

/**
 * Generates the array of calendar day objects.
 * This was missing from the file and is needed by +page.svelte.
 */
export function generateCalendarDays(startDate, numDaysToShow, holidays, getWorkHoursPerDay, START_HOUR, DAY_COLUMN_WIDTH) {
    const days = [];
    const todayStr = formatDate(new Date(), 'YYYY-MM-DD');

    for (let i = 0; i < numDaysToShow; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dateStr = formatDate(date, 'YYYY-MM-DD');
        const dayOfWeek = date.getDay();
        const workHours = getWorkHoursPerDay(dayOfWeek); // Use the passed-in function
        const isHoliday = holidays.has(dateStr);
        const isBlocked = workHours === 0 || isHoliday;

        days.push({
            date,
            dayOfWeek,
            workHours,
            isHoliday,
            isBlocked,
            isToday: dateStr === todayStr,
            // Add the config object that getPixelOffsetForDate expects
            config: {
                START_HOUR,
                DAY_COLUMN_WIDTH
            }
        });
    }
    return days;
}

/**
 * Calculates the absolute pixel offset for a given date/time.
 * Returns null if the date is not in the visible calendar.
 */
export function getPixelOffsetForDate(date, calendarDays, START_HOUR_config, DAY_COLUMN_WIDTH_config) {
    if (!calendarDays || calendarDays.length === 0) return null;

    const dateObj = new Date(date);
    const dateStr = formatDate(dateObj, 'YYYY-MM-DD');
    const dayIndex = calendarDays.findIndex(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
    
    // Not on calendar
    if (dayIndex === -1) return null;

    const day = calendarDays[dayIndex];
    // Use the config passed from the day object
    const { START_HOUR, DAY_COLUMN_WIDTH } = day.config;
    
    // If date is on a blocked day, snap to the start of the day block
    if (day.isBlocked || day.workHours === 0) {
        return dayIndex * DAY_COLUMN_WIDTH;
    }

    const totalWorkMinutes = day.workHours * 60;
    const dayWorkStart = new Date(day.date);
    dayWorkStart.setHours(START_HOUR, 0, 0, 0);

    const dayWorkEnd = new Date(dayWorkStart.getTime() + day.workHours * 60 * 60000);

    // Clamp task time to workday
    const effectiveTime = new Date(Math.max(dayWorkStart.getTime(), Math.min(dayWorkEnd.getTime(), dateObj.getTime())));
    let taskOffsetMinutes = (effectiveTime.getTime() - dayWorkStart.getTime()) / (1000 * 60);

    // Handle potential division by zero if totalWorkMinutes is 0 (though blocked day check should catch it)
    if (totalWorkMinutes === 0) {
        return dayIndex * DAY_COLUMN_WIDTH;
    }

    const leftPercent = (taskOffsetMinutes / totalWorkMinutes);
    const leftPixelOffset = leftPercent * DAY_COLUMN_WIDTH;

    return (dayIndex * DAY_COLUMN_WIDTH) + leftPixelOffset;
}

/**
 * Calculates a new end date based on a start date and a total *work* duration.
 * FIX: Added 'getWorkHoursPerDay' as an argument, as it's passed from +page.svelte.
 */
export function calculateNewEndDate(newStartDate, workDurationMinutes, calendarDays, START_HOUR, getWorkHoursPerDay) {
    let minutesToDistribute = workDurationMinutes;
    let newEndDate = new Date(newStartDate);
    let dateStr = formatDate(newStartDate, 'YYYY-MM-DD');
    let currentDayIndex = calendarDays.findIndex(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

    if (currentDayIndex === -1) {
        console.error("Could not find start day in calendar");
        // Try to find the first available day if start is out of bounds
        currentDayIndex = 0; 
        // return newStartDate; // Failsafe
    }

    while (minutesToDistribute > 0 && currentDayIndex < calendarDays.length) {
        const currentDay = calendarDays[currentDayIndex];
        
        // We must check if currentDay is valid
        if (!currentDay) {
            console.error("Calendar data is invalid at index:", currentDayIndex);
            break; // Exit loop to prevent crash
        }

        // Use the passed-in getWorkHoursPerDay function
        const currentDayWorkHours = getWorkHoursPerDay(currentDay.date.getDay());
        const isHoliday = currentDay.isHoliday; // Assuming generateCalendarDays adds this
        const isBlocked = currentDayWorkHours === 0 || isHoliday;
        
        if (!isBlocked && currentDayWorkHours > 0) {
            const dayWorkStart = new Date(currentDay.date);
            dayWorkStart.setHours(START_HOUR, 0, 0, 0);
            const dayWorkEnd = new Date(dayWorkStart.getTime() + currentDayWorkHours * 60 * 60000);

            const calcStart = new Date(Math.max(newEndDate.getTime(), dayWorkStart.getTime()));
            let minutesAvailable = (dayWorkEnd.getTime() - calcStart.getTime()) / (1000 * 60);
            
            if (minutesAvailable <= 0) {
                currentDayIndex++;
                if (currentDayIndex < calendarDays.length) {
                    newEndDate = new Date(calendarDays[currentDayIndex].date);
                    newEndDate.setHours(START_HOUR, 0, 0, 0);
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
                newEndDate.setHours(START_HOUR, 0, 0, 0);
            }
        }
    }
    
    // If we ran out of calendar days, return the end of the last calculated day
    if (minutesToDistribute > 0) {
        console.warn("Could not distribute all minutes. Task extends beyond visible calendar.");
    }

    return newEndDate;
}

/**
 * Checks if a new task placement overlaps with existing tasks.
 */
export function isOverlapping(taskIdToIgnore, lineId, newStart, newEnd, allTasks) {
    const tasksOnLine = allTasks.filter(t => t.lineId === lineId && t.id !== taskIdToIgnore);
    
    for (const task of tasksOnLine) {
        const existingStart = new Date(task.start);
        const existingEnd = new Date(task.end);

        // Standard collision detection: (StartA < EndB) and (EndA > StartB)
        if (newStart < existingEnd && newEnd > existingStart) {
            return true; // Overlap found
        }
    }
    return false; // No overlap
}