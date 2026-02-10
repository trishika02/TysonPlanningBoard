/**
 * Calculates generic task timelines using Style & Learning Curve data.
 * 
 * @param {Array} tasks - Tasks to schedule [{id, lineId, quantity, style}]
 * @param {Array} dailyWorkHours - Calendar availability from API (or generated locally if simpler)
 * @param {Array} operationBulletins - OB Data from API
 * @param {Array} learningCurves - LC Data from API
 * @param {Date} [globalStartDate] - Project start date
 */
export const calculateTaskTimeline = (tasks, dailyWorkHours, operationBulletins, learningCurves, globalStartDate = new Date()) => {

    // --- 1. Index Data for O(1) Access ---

    // Map: LineID -> DateString -> DayData
    const calendar = {};
    if (Array.isArray(dailyWorkHours)) {
        dailyWorkHours.forEach(d => {
            if (!d.Line) return;
            if (!calendar[d.Line]) calendar[d.Line] = {};
            calendar[d.Line][d.Date] = d;
        });
    }

    // Map: StyleName -> OB Data
    const obMap = operationBulletins.reduce((acc, item) => ({ ...acc, [item.style]: item }), {});

    // Map: CurveID -> Curve Data
    const lcMap = learningCurves.reduce((acc, item) => ({ ...acc, [item.name]: item.details }), {});

    // Tracker: Next free slot per line (not fully used if we just do single task calc, but good for batch)
    const lineClock = {};

    // --- 2. Process Tasks ---

    return tasks.map(task => {
        // Validation & Setup for single task calculation happens in helper
        return calculateSingleTaskTimeline(task, calendar, obMap, lcMap, globalStartDate, lineClock);
    });
};

/**
 * Calculates timeline for a single task.
 * Can be used directly when dragging a single task.
 * 
 * @param {Object} task - The task object { id, lineId, quantity, style }
 * @param {Object} calendarMap - Pre-indexed calendar map { LineID: { DateString: DayData } }
 * @param {Object} obMap - Pre-indexed OB map { StyleName: OBData }
 * @param {Object} lcMap - Pre-indexed LC map { CurveName: LCDetails }
 * @param {Date} startDateOverride - If provided, forces start date (e.g. from Drag & Drop)
 * @param {Object} lineClock - Optional tracker for batch processing
 */
export const calculateSingleTaskTimeline = (task, calendarMap, obMap, lcMap, startDateOverride, lineClock = {}) => {
    console.log("Starting calculation for task:", task.style, "Quantity:", task.quantity);
    const { id, lineId, style, quantity } = task;

    // Validation
    const ob = obMap[style];

    // If we don't have OB data, just return task as is (maybe add error/warning flag)
    if (!ob) {
        console.warn(`No Operation Bulletin found for Style: ${style}`);
        return { ...task, error: 'No OB found' };
    } else {
        console.log("Found OB:", ob);
    }

    if (!lineId) {
        return { ...task, error: 'No Line ID' };
    }

    // OB Parameters
    const smv = ob.smv || 15;
    const manpower = ob.total_manpower || 20;
    const curveId = ob.learning_curve;
    const efficiencyDetails = lcMap[curveId] || []; // Array of {day, efficiency}
    console.log(`Parameters: SMV=${smv}, Manpower=${manpower}, Curve=${curveId}`);

    // Determine Start Time
    // If startDateOverride is provided (Drag Drop), use it.
    // Otherwise use lineClock (Batch Schedule) or current time.
    let currentTime;
    if (startDateOverride) {
        currentTime = new Date(startDateOverride);
    } else {
        const lineFreeTime = lineClock[lineId] || new Date(); // Default to now if no clock
        currentTime = new Date(lineFreeTime);
    }

    const startDate = new Date(currentTime);
    const timeline = [];
    let remainingQty = quantity;

    // "Production Day" counter for Learning Curve (only increments on working days where production happens)
    let productionDayIndex = 0;
    let safetyCounter = 0;

    // We need a helper to check work hours if not in calendar map strings
    // But assuming calendarMap is populated with real API data strings "DD-MM-YYYY" or similar?
    // The user provided snippets use "dd-mm-yyyy" in the prompt example, but "YYYY-MM-DD" in Calendar.svelte.
    // Let's standardise on "YYYY-MM-DD" inside this utility for consistency with Calendar.svelte,
    // OR allow the map to handle it. 
    // The prompt used: const formatDate = (date) => `${d}-${m}-${y}`;
    // But Calendar.svelte uses YYYY-MM-DD. 
    // CHECK: The api-call.js fetches data. The structure in Calendar.svelte for `workHourDataList` 
    // seems to imply it has `Date` property. 
    // Let's implement `formatDate` to match the keys in `calendarMap`.
    // If `calendarMap` is built from `dailyWorkHours` which presumably has "YYYY-MM-DD" or similar.
    // Let's stick to the prompt's `formatDate` logic but adapt if keys don't match.
    // ACTUALLY: The prompt specifically had:
    // const formatDate = (date) => { const d=...; return `${d}-${m}-${y}`; };
    // This implies the keys in `dailyWorkHours` might be DD-MM-YYYY.
    // However, `getWorkHourData` in `api-call.js` uses `from_data = '2026-02-01'`.
    // Let's look at `calendarMap` construction in the main function.
    // If I build `calendarMap` myself in `calculateSingleTaskTimeline` (if passed as array), I can control the key.
    // BUT `calculateTaskTimeline` builds it.

    // Let's assume input `calendarMap` keys match `formatDate` output.
    // I will use a local `formatDate` that tries to match standard ISO first (YYYY-MM-DD).

    const formatDate = (date) => {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${y}-${m}-${d}`; // Going with ISO for safety unless data proves otherwise
    };

    while (remainingQty > 0 && safetyCounter < 730) { // 2 year limit
        // We need to look up the day in the calendar.
        // If calendarMap is empty/undefined, we fall back to standard logic (e.g. 9-5 MF).
        // But for this specific requirement, let's implement the logic requested.

        // ISSUE: The keys in `dailyWorkHours` might be "DD-MM-YYYY" based on user prompt.
        // But let's check what `api-call.js` likely returns. 
        // `getLineWorkHours` in Calendar.svelte splits `dateStr` (YYYY-MM-DD) to form DD-MM-YYYY for lookup!
        // `let date_ = `${dateStr.split('-')[2]}-${dateStr.split('-')[1]}-${dateStr.split('-')[0]}`;`
        // So the API data uses DD-MM-YYYY.

        // So my `formatTaskDate` for Map lookup MUST be DD-MM-YYYY.
        const dateKey = ((date) => {
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            return `${d}-${m}-${y}`;
        })(currentTime);

        const calendarDay = calendarMap[lineId]?.[dateKey];
        // console.log(`Processing ${dateKey}. Calendar Data:`, calendarDay ? "Yes" : "No");

        // 1. Check if Shop Floor is Open
        // If no record, we might fallback to standard weekend logic, OR as per prompt: 
        // "If no record, or 0 work hours, it's a holiday/off-day."

        // NOTE: In `Calendar.svelte`, `getLineWorkHours` falls back to `getStandardWorkHours(date.getDay())`.
        // We should probably do the same here to be consistent.
        let isWorkingDay = false;
        let workHour = 0;
        let shiftStartStr = "08:00:00"; // Default start

        if (calendarDay) {
            workHour = calendarDay.WorkHour;
            shiftStartStr = calendarDay.ShiftStartTime || "08:00:00";
            if (workHour > 0) isWorkingDay = true;
        } else {
            // Fallback
            const dayOfWeek = currentTime.getDay();
            // 0=Sun, 5=Fri, 6=Sat. 
            // In Bangladesh (often Fri is off). Calendar.svelte says Fri(5), Sat(6) are 0 hours.
            if (dayOfWeek !== 5 && dayOfWeek !== 6) {
                workHour = 9; // Standard fallback
                isWorkingDay = true;
            }
        }

        if (!isWorkingDay) {
            // Advance clock to next day 00:00
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
            safetyCounter++;
            continue;
        }

        // 2. Set Shift Boundaries
        const [sh, sm, ss] = shiftStartStr.split(':').map(Number);
        const shiftStart = new Date(currentTime);
        shiftStart.setHours(sh, sm, ss || 0, 0);

        // Align current time to shift start if we are early (e.g. 00:00)
        if (currentTime < shiftStart) {
            currentTime = new Date(shiftStart);
        }

        // Shift End = Start + Duration
        const shiftDurationMs = workHour * 60 * 60 * 1000;
        const shiftEnd = new Date(shiftStart.getTime() + shiftDurationMs);

        // If we missed the shift (e.g. looking at 6 PM but shift ended 5 PM), move next day
        // Tolerance: if we are AT shiftEnd, we are done for the day.
        if (currentTime >= shiftEnd) {
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
            safetyCounter++;
            continue;
        }

        // 3. Determine Efficiency for *this specific day of production*
        // If we run out of defined curve days, use the last defined efficiency.
        let dailyEff = 0;
        if (efficiencyDetails.length > 0) {
            const curveDay = efficiencyDetails[Math.min(productionDayIndex, efficiencyDetails.length - 1)];
            dailyEff = curveDay.efficiency;
        } else {
            dailyEff = calendarDay?.Efficiency || 50; // Fallback to line default
        }

        if (dailyEff <= 0 || manpower <= 0) {
            currentTime.setDate(currentTime.getDate() + 1);
            safetyCounter++;
            continue;
        }

        // 4. Calculate Output
        // Rate (Pcs/ms) = (Manpower * Eff% * 60) / SMV / 3600000
        // Wait, User Formula: ((manpower * (dailyEff / 100)) * 60) / smv  -> Pcs Per Hour
        // Pcs Per Ms = Pcs Per Hour / 3600000
        const pcsPerHour = ((manpower * (dailyEff / 100)) * 60) / smv;
        const pcsPerMs = pcsPerHour / 3600000;

        const timeRemainingMs = shiftEnd.getTime() - currentTime.getTime();
        const maxProduction = Math.floor(timeRemainingMs * pcsPerMs);
        const todaysProduction = Math.min(remainingQty, maxProduction);

        // console.log(`  Prod: ${todaysProduction}, Eff: ${dailyEff}%, Rem: ${remainingQty}`);

        // 5. Update State
        timeline.push({
            date: dateKey,
            produced: todaysProduction,
            efficiency: dailyEff,
            manpower: manpower,
            learningCurveDay: productionDayIndex + 1
        });

        // Time consumed for *actual* production
        // If todaysProduction is 0 (unlikely if time remains), we consume 0
        const timeConsumedMs = todaysProduction / pcsPerMs;

        currentTime = new Date(currentTime.getTime() + timeConsumedMs);
        remainingQty -= todaysProduction;

        // Increment LC Day only if we actually produced something significant
        if (todaysProduction > 0) {
            productionDayIndex++;
        }

        // If we still have qty, it implies we hit shift end (or very close to it). 
        // Even if we have tiny time left, if we can't produce 1 unit, we move on?
        // Simple logic: if remainingQty > 0, we must continue. 
        // If we are at shiftEnd, loop will naturally handle it next iteration.
        // But let's force rollover if we are very close to end to avoid infinite loops with tiny ms.
        if (remainingQty > 0 && (shiftEnd.getTime() - currentTime.getTime()) < 1000) {
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(0, 0, 0, 0);
        }

        safetyCounter++;
    }

    console.log("Calculation Complete. End:", currentTime.toISOString());

    // Update Line Clock
    lineClock[lineId] = new Date(currentTime);

    return {
        ...task,
        start: startDate.toISOString(),
        end: currentTime.toISOString(),
        timeline,
        // Helper calculated fields
        durationMs: currentTime.getTime() - startDate.getTime(),
        total_days: Math.ceil((currentTime.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    };
};
