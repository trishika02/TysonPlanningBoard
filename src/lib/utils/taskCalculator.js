/**
 * Task Calculator Utility - Production System Logic
 * Handles task duration calculations based on learning curves, daily work hours, and line scheduling
 */

/**
 * Format date to DD-MM-YYYY string (matching API format)
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

/**
 * Format date to YYYY-MM-DD string
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calculate timeline for a single strip
 * @param {Object} strip - Strip data
 * @param {Array} dailyWorkHours - Array from get_daily_work_hours API
 * @param {Date} startDate - Start date for this strip
 * @returns {Object} Strip with calculated timeline
 */
export const calculateSingleStripTimeline = (strip, dailyWorkHours, startDate) => {
    // Build calendar lookup: calendar[lineId][dateKey] = workHourData
    const calendar = {};
    dailyWorkHours.forEach((d) => {
        if (!d.Line) return;
        if (!calendar[d.Line]) calendar[d.Line] = {};
        calendar[d.Line][d.Date] = d;
    });

    const { lineId, quantity, smv, totalManpower, learningCurveTable } = strip;

    if (!lineId) return { ...strip, error: 'No Line ID' };

    let currentTime = new Date(startDate);
    const timeline = [];
    let remainingQty = quantity;
    let productionDayIndex = 0;
    let safetyCounter = 0;

    console.log('=== CALCULATOR START DEBUG ===');
    console.log('Input startDate:', startDate);
    console.log('currentTime initialized:', currentTime.toISOString());
    console.log('currentTime local:', currentTime.toString());
    console.log('==============================');

    while (remainingQty > 0 && safetyCounter < 730) {
        const dateKey = formatDate(currentTime);
        const calendarDay = calendar[lineId]?.[dateKey];

        if (safetyCounter === 0) {
            console.log('=== FIRST ITERATION DEBUG ===');
            console.log('currentTime:', currentTime.toISOString());
            console.log('dateKey formatted:', dateKey);
            console.log('calendarDay found:', calendarDay);
            console.log('=============================');
        }

        // Skip days with no work hours
        if (!calendarDay || !calendarDay.WorkHour || calendarDay.WorkHour <= 0) {
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
            safetyCounter++;
            continue;
        }

        // Parse shift start time
        const [sh, sm, ss] = (calendarDay.ShiftStartTime || '09:00:00').split(':').map(Number);
        const shiftStart = new Date(currentTime);
        shiftStart.setHours(sh, sm, ss || 0, 0);

        // If current time is before shift start, move to shift start
        if (currentTime < shiftStart) currentTime = new Date(shiftStart);

        // Calculate shift end time
        const shiftDurationMs = calendarDay.WorkHour * 60 * 60 * 1000;
        const shiftEnd = new Date(shiftStart.getTime() + shiftDurationMs);

        // If current time is past shift end, move to next day
        if (currentTime >= shiftEnd) {
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
            safetyCounter++;
            continue;
        }

        // Get efficiency from learning curve or calendar
        let dailyEff = 0;
        if (learningCurveTable && learningCurveTable.length > 0) {
            const curveDay =
                learningCurveTable[Math.min(productionDayIndex, learningCurveTable.length - 1)];
            dailyEff = curveDay.efficiency;
        } else {
            dailyEff = calendarDay.Efficiency || 50;
        }

        // Skip if no efficiency or manpower
        if (dailyEff <= 0 || totalManpower <= 0) {
            currentTime.setDate(currentTime.getDate() + 1);
            safetyCounter++;
            continue;
        }

        // Calculate production rate
        // Formula: pcsPerHour = (totalManpower * efficiency%) * 60 / smv
        const pcsPerHour = ((totalManpower * (dailyEff / 100)) * 60) / smv;
        const pcsPerMs = pcsPerHour / 3600000; // Convert to pieces per millisecond

        // Calculate how much can be produced in remaining shift time
        const timeRemainingMs = shiftEnd - currentTime;
        const maxProduction = Math.floor(timeRemainingMs * pcsPerMs);
        const todaysProduction = Math.min(remainingQty, maxProduction);

        // Record start time for this day's production
        const dayStartTime = new Date(currentTime);

        // Calculate end time based on production
        const timeConsumedMs = todaysProduction / pcsPerMs;
        const dayEndTime = new Date(currentTime.getTime() + timeConsumedMs);

        // Record timeline entry with start and end times
        timeline.push({
            date: dateKey,
            produced: todaysProduction,
            efficiency: dailyEff,
            manpower: totalManpower,
            learningCurveDay: productionDayIndex + 1,
            startTime: dayStartTime.toISOString(),
            endTime: dayEndTime.toISOString()
        });

        // Update current time based on production
        currentTime = dayEndTime;
        remainingQty -= todaysProduction;

        // Increment production day if we produced something
        if (todaysProduction > 0) {
            productionDayIndex++;
        }
        // Move to next day if there's still quantity remaining
        if (remainingQty > 0) {
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
        }
        safetyCounter++;
    }

    return {
        ...strip,
        startDate: startDate.toISOString(),
        endDate: currentTime.toISOString(),
        timeline
    };
};

/**
 * Calculate timeline for strips using embedded learning curve data
 * @param {Array} strips - Array from get_strips_with_learning_curve API
 * @param {Array} dailyWorkHours - Array from get_daily_work_hours API
 * @param {Date} globalStartDate - Project start date
 * @returns {Array} Strips with calculated timeline
 */
export const calculateStripTimeline = (strips, dailyWorkHours, globalStartDate = new Date()) => {
    // Build calendar lookup: calendar[lineId][dateKey] = workHourData
    const calendar = {};
    dailyWorkHours.forEach((d) => {
        if (!d.Line) return;
        if (!calendar[d.Line]) calendar[d.Line] = {};
        calendar[d.Line][d.Date] = d;
    });

    // Track when each line is free (for sequential scheduling)
    const lineClock = {};

    return strips.map((strip) => {
        const { lineId, quantity, smv, totalManpower, learningCurveTable } = strip;

        if (!lineId) return { ...strip, error: 'No Line ID' };

        const lineFreeTime = lineClock[lineId] || globalStartDate;
        let currentTime = new Date(Math.max(new Date(globalStartDate), new Date(lineFreeTime)));

        const startDate = new Date(currentTime);
        const timeline = [];
        let remainingQty = quantity;
        let productionDayIndex = 0;
        let safetyCounter = 0;

        while (remainingQty > 0 && safetyCounter < 730) {
            const dateKey = formatDate(currentTime);
            const calendarDay = calendar[lineId]?.[dateKey];

            // Skip days with no work hours
            if (!calendarDay || !calendarDay.WorkHour || calendarDay.WorkHour <= 0) {
                currentTime.setDate(currentTime.getDate() + 1);
                currentTime.setHours(0, 0, 0, 0);
                safetyCounter++;
                continue;
            }

            // Parse shift start time
            const [sh, sm, ss] = (calendarDay.ShiftStartTime || '09:00:00').split(':').map(Number);
            const shiftStart = new Date(currentTime);
            shiftStart.setHours(sh, sm, ss || 0, 0);

            // If current time is before shift start, move to shift start
            if (currentTime < shiftStart) currentTime = new Date(shiftStart);

            // Calculate shift end time
            const shiftDurationMs = calendarDay.WorkHour * 60 * 60 * 1000;
            const shiftEnd = new Date(shiftStart.getTime() + shiftDurationMs);

            // If current time is past shift end, move to next day
            if (currentTime >= shiftEnd) {
                currentTime.setDate(currentTime.getDate() + 1);
                currentTime.setHours(0, 0, 0, 0);
                safetyCounter++;
                continue;
            }

            // Get efficiency from learning curve or calendar
            let dailyEff = 0;
            if (learningCurveTable && learningCurveTable.length > 0) {
                const curveDay =
                    learningCurveTable[Math.min(productionDayIndex, learningCurveTable.length - 1)];
                dailyEff = curveDay.efficiency;
            } else {
                dailyEff = calendarDay.Efficiency || 50;
            }

            // Skip if no efficiency or manpower
            if (dailyEff <= 0 || totalManpower <= 0) {
                currentTime.setDate(currentTime.getDate() + 1);
                safetyCounter++;
                continue;
            }

            // Calculate production rate
            // Formula: pcsPerHour = (totalManpower * efficiency%) * 60 / smv
            const pcsPerHour = ((totalManpower * (dailyEff / 100)) * 60) / smv;
            const pcsPerMs = pcsPerHour / 3600000; // Convert to pieces per millisecond

            // Calculate how much can be produced in remaining shift time
            const timeRemainingMs = shiftEnd - currentTime;
            const maxProduction = Math.floor(timeRemainingMs * pcsPerMs);
            const todaysProduction = Math.min(remainingQty, maxProduction);

            // Record start time for this day's production
            const dayStartTime = new Date(currentTime);

            // Calculate end time based on production
            const timeConsumedMs = todaysProduction / pcsPerMs;
            const dayEndTime = new Date(currentTime.getTime() + timeConsumedMs);

            // Record timeline entry with start and end times
            timeline.push({
                date: dateKey,
                produced: todaysProduction,
                efficiency: dailyEff,
                manpower: totalManpower,
                learningCurveDay: productionDayIndex + 1,
                startTime: dayStartTime.toISOString(),
                endTime: dayEndTime.toISOString()
            });

            // Update current time based on production
            currentTime = dayEndTime;
            remainingQty -= todaysProduction;

            // Increment production day if we produced something
            if (todaysProduction > 0) {
                productionDayIndex++;
            }

            // Move to next day if there's still quantity remaining
            if (remainingQty > 0) {
                currentTime.setDate(currentTime.getDate() + 1);
                currentTime.setHours(0, 0, 0, 0);
            }
            safetyCounter++;
        }

        // Update line clock so next strip on this line starts after this one
        lineClock[lineId] = new Date(currentTime);

        return {
            ...strip,
            startDate: startDate.toISOString(),
            endDate: currentTime.toISOString(),
            timeline
        };
    });
};

/**
 * Transform API strip data to application task format
 * @param {Object} strip - Strip data from API (with calculated timeline)
 * @returns {Object} Transformed task object
 */
export function transformStripToTask(strip) {
    // Calculate total days and working days from timeline
    const totalDays = strip.timeline ? strip.timeline.length : 0;
    const workingDays = totalDays;

    // Calculate completed quantity from timeline
    const completedQty = strip.plannedQty || 0;

    // Format dates
    const startISO = strip.startDate || new Date().toISOString();
    const endISO = strip.endDate || new Date().toISOString();

    return {
        id: strip.id,
        lineId: strip.lineId || '',
        orderId: strip.sales_order || '',
        style: `${strip.style || ''} (${strip.color || ''})`.trim(),
        quantity: strip.quantity || strip.totalQty || 0,
        start: startISO,
        end: endISO,
        total_days: totalDays,
        total_working_days: workingDays,
        completed_days: 0,
        completed_quantity: completedQty,
        completed_segments: [],
        // Additional metadata
        customer: strip.customer,
        smv: strip.smv,
        manpower: strip.totalManpower,
        status: strip.status,
        learningCurve: strip.learningCurveTable,
        timeline: strip.timeline,
        error: strip.error
    };
}

/**
 * Transform array of strips to tasks
 * @param {Array} strips - Array of strip data from API (with calculated timelines)
 * @returns {Object} Object with planned and unplanned tasks
 */
export function transformStripsToTasks(strips = []) {
    const tasks = strips.map((strip) => transformStripToTask(strip));

    // Separate into planned (with lineId) and unplanned (without lineId or with error)
    const planned = tasks.filter((task) => task.lineId && task.lineId !== '' && !task.error);
    const unplanned = tasks.filter((task) => !task.lineId || task.lineId === '' || task.error);

    return {
        planned,
        unplanned,
        all: tasks
    };
}
