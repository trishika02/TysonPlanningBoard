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
        // Use the shift-aligned start of the first production entry (if any) rather than
        // the raw input startDate — the loop above may advance past midnight to the
        // line's actual shift start time on day 1.
        startDate: timeline.length > 0 ? timeline[0].startTime : startDate.toISOString(),
        endDate: currentTime.toISOString(),
        timeline
    };
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
    const completedQty = strip.completedQty || 0;

    // Never mix sources: current-time fallback for start + real past deliveryDate for end = end < start
    let startISO, endISO;
    if (strip.startDate && strip.endDate) {
        // Best case: calculated timeline dates
        startISO = strip.startDate;
        endISO = strip.endDate;
    } else if (strip.sewingStartDate) {
        // DB pair: sewing start + delivery date
        startISO = new Date(strip.sewingStartDate).toISOString();
        endISO = strip.deliveryDate
            ? new Date(strip.deliveryDate).toISOString()
            : startISO;
    } else if (strip.deliveryDate) {
        // Only have delivery date — use as both (zero-width point, at least it's in the right place)
        startISO = new Date(strip.deliveryDate).toISOString();
        endISO = startISO;
    } else {
        startISO = new Date().toISOString();
        endISO = startISO;
    }
    // Guard: end must not be before start (would give negative total_days)
    if (endISO < startISO) endISO = startISO;

    console.log('[transformStripToTask]', strip.id, {
        raw_startDate: strip.startDate,
        raw_endDate: strip.endDate,
        raw_sewingStartDate: strip.sewingStartDate,
        raw_deliveryDate: strip.deliveryDate,
        resolved_startISO: startISO,
        resolved_endISO: endISO,
        timeline_length: strip.timeline?.length ?? 0,
    });

    return {
        id: strip.id,
        lineId: strip.lineId || '',
        planningBoard: strip.planningBoard || '',
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


function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDateYMD(date) {
    // Use LOCAL date components — toISOString() shifts to UTC, which moves timeline
    // dates to the previous day for local times earlier than the UTC offset.
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeStringToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
}

function secondsToTimeString(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function getLargerTime(a, b) {
    return timeStringToSeconds(a) >= timeStringToSeconds(b) ? a : b;
}

function addHoursToTime(timeStr, hours) {
    const [h, m, s] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, s || 0);
    d.setHours(d.getHours() + Math.floor(hours));
    d.setMinutes(d.getMinutes() + Math.round((hours - Math.floor(hours)) * 60));
    return d.toTimeString().slice(0, 8);
}

function getHoursAndMinutes(timeStr) {
    return timeStr.split(':').map(Number);
}

// ──────────────────────────────────────────────
// Core calculation functions (matching calculations.js)
// ──────────────────────────────────────────────

function calculatePerHourQuantity(efficiency, manpower, smv) {
    return ((efficiency / 100) * manpower * 60) / smv;
}

function calculateDayCapacity(perHourQty, workingHours) {
    return perHourQty * workingHours;
}

function calculateWorkingHoursOnProdQty(dayCapacity, smv, efficiency, manpower) {
    return (dayCapacity * smv) / (efficiency / 100) / (manpower * 60);
}

function calculateProductionQty(perHourQty, workingHours) {
    return perHourQty * workingHours;
}

function calculateTotalMinutes(productionQty, smv) {
    return productionQty * smv;
}

function calculateStripPendingQty(previousPending, currentProduction) {
    return previousPending - currentProduction;
}

function calculateStripProducedQty(dailyProductionArray) {
    return dailyProductionArray.reduce((sum, qty) => sum + qty, 0);
}

function calculateTotalQty(pendingQty, producedQty) {
    return pendingQty + producedQty;
}

// ──────────────────────────────────────────────
// Main timeline generator
// ──────────────────────────────────────────────

/**
 * Generate timeline for a single strip — output matches ERPNext generateTimeLine exactly.
 *
 * @param {Object} strip - Strip data from get_strips_with_learning_curve API
 * @param {Array}  workhourData - Daily Work Hour records for this strip's line,
 *                                filtered from get_daily_work_hours where Line === strip.lineId,
 *                                sorted by date ascending.
 * @param {Object} shiftData - Shift details from get_shift_details API for the relevant shift.
 *                              e.g. { name, startTime, endTime, durationHours }
 * @param {number} [stripQtyOverride] - Optional override for strip quantity (used in split)
 *
 * @returns {{ timeline: Array, planned_qty: number }}
 *   timeline rows have the same fields as Strip Timeline Table:
 *     date, day, shift_start_time, shift_end_time, working_hour_day_capacity,
 *     working_hour, man_power, efficiency, per_hour_qty, target_qty_at_100_eff,
 *     day_capacity, planned_production_qty, total_minutes,
 *     strip_pending_qty, strip_produced_qty, total_qty
 */
export function generateTimeline(strip, workhourData, shiftData, stripQtyOverride) {
    const {
        smv,
        totalManpower,
        learningCurveTable,
        sewingStartDate,
    } = strip;

    // Safe helper: get efficiency from learning curve, or fall back to 50%
    const curve = Array.isArray(learningCurveTable) && learningCurveTable.length > 0
        ? learningCurveTable
        : null;
    const getEfficiency = (dayIndex) => {
        if (!curve) return 50;
        const entry = curve[Math.min(dayIndex, curve.length - 1)];
        return (entry && entry.efficiency != null) ? entry.efficiency : 50;
    };

    let stripPendingQty = stripQtyOverride ?? strip.quantity;
    let planned_qty = 0;
    let counter = 0;
    let safetyCounter = 0;
    const dailyProductionArray = [];
    const rows = [];

    // Parse the start as an instant, then take LOCAL components for the base day and
    // first-day start time. Correct for both input forms: 'YYYY-MM-DD HH:mm:ss' (local
    // wall time from the API) parses as local, and ISO 'Z' strings (from the drop
    // handler's toISOString()) parse as UTC — either way the local wall clock below is
    // the same one the backend uses when it regenerates the timeline on save.
    const startInstant = new Date(sewingStartDate);
    const baseDate = new Date(startInstant.getFullYear(), startInstant.getMonth(), startInstant.getDate());
    const padT = (n) => String(n).padStart(2, '0');
    const sewingStartTime = `${padT(startInstant.getHours())}:${padT(startInstant.getMinutes())}:${padT(startInstant.getSeconds())}`;

    const shiftStartTime = shiftData.startTime;

    // Match the backend's fetch_work_hour_data exactly (strip.py): only records on/after
    // the strip's own start date, in chronological order, accessed BY POSITION per day
    // counter — not by re-deriving each day's date and searching for a match. Date-matching
    // with an index-cycling fallback (the old approach) silently diverges from the backend
    // the moment the source data has any gap or ordering quirk, since Python's `workhour_data
    // [counter]` has no such fallback — it's pure position. Filtering + sorting once here
    // makes position 0 the true first day, exactly like the backend, so every subsequent
    // position lines up the same way on both sides.
    const toISODate = (ddmmyyyy) => {
        const [d, m, y] = ddmmyyyy.split('-');
        return `${y}-${m}-${d}`;
    };
    const baseDateISO = formatDateYMD(baseDate);
    const relevantWorkHours = workhourData
        .filter((r) => toISODate(r.Date) >= baseDateISO)
        .sort((a, b) => toISODate(a.Date).localeCompare(toISODate(b.Date)));

    while (stripPendingQty > 0 && safetyCounter < 730 && counter < relevantWorkHours.length) {
        const row = {};

        // --- Date & Day ---
        const currentDate = addDays(baseDate, counter);
        row.date = formatDateYMD(currentDate);
        row.day = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

        // --- Working Hour (Day Capacity) ---
        const workhourRecord = relevantWorkHours[counter];
        const workHour = workhourRecord?.WorkHour ?? 0;

        // === OFF DAY: WorkHour === 0 → planned_production_qty = 0, skip to next day ===
        if (workHour === 0) {
            dailyProductionArray.push(0);
            const producedSoFar = calculateStripProducedQty(dailyProductionArray);
            rows.push({
                date: row.date,
                day: row.day,
                shift_start_time: shiftStartTime,
                shift_end_time: shiftStartTime,
                working_hour_day_capacity: 0,
                working_hour: 0,
                man_power: totalManpower,
                efficiency: getEfficiency(counter),
                per_hour_qty: 0,
                target_qty_at_100_eff: 0,
                day_capacity: 0,
                planned_production_qty: 0,
                total_minutes: 0,
                strip_pending_qty: stripPendingQty,
                strip_produced_qty: producedSoFar,
                total_qty: calculateTotalQty(stripPendingQty, producedSoFar)
            });
            counter++;
            safetyCounter++;
            continue;
        }

        const shiftEndTime = addHoursToTime(shiftStartTime, workHour);

        row.shift_start_time = shiftStartTime;

        // First day: adjust start time if sewing starts after shift start
        if (counter === 0) {
            row.shift_start_time = getLargerTime(shiftStartTime, sewingStartTime);
        }

        const [startH, startM] = getHoursAndMinutes(row.shift_start_time);
        const startMinutes = startH * 60 + startM;

        const adjustedEnd = getLargerTime(row.shift_start_time, shiftEndTime);
        const [endH, endM] = getHoursAndMinutes(adjustedEnd);
        const endMinutes = endH * 60 + endM;

        row.working_hour_day_capacity = (endMinutes - startMinutes) / 60;

        // --- Manpower ---
        row.man_power = totalManpower;

        row.efficiency = getEfficiency(counter);

        // --- Per Hour Qty (floored — matches ERPNext) ---
        row.per_hour_qty = Math.floor(
            calculatePerHourQuantity(row.efficiency, totalManpower, smv)
        );

        row.target_qty_at_100_eff = Math.floor(
            calculatePerHourQuantity(100, totalManpower, smv)
        );

        // --- Day Capacity ---
        row.day_capacity = calculateDayCapacity(row.per_hour_qty, row.working_hour_day_capacity);

        // --- Working Hour (production-based) ---
        row.working_hour = calculateWorkingHoursOnProdQty(
            row.day_capacity, smv, row.efficiency, row.man_power
        );

        // --- Planned Production Qty ---
        row.planned_production_qty = Math.floor(
            calculateProductionQty(row.per_hour_qty, row.working_hour)
        );

        // --- Total Minutes ---
        row.total_minutes = calculateTotalMinutes(row.planned_production_qty, smv);

        // --- Strip Pending Qty ---
        row.strip_pending_qty = calculateStripPendingQty(
            stripPendingQty, row.planned_production_qty
        );

        // --- If remaining qty < day capacity, recalculate for partial day ---
        if (row.strip_pending_qty < 0) {
            row.working_hour = stripPendingQty / row.per_hour_qty;
            row.planned_production_qty = calculateProductionQty(
                row.per_hour_qty, row.working_hour
            );
            row.strip_pending_qty = calculateStripPendingQty(
                stripPendingQty, row.planned_production_qty
            );
        }

        // --- Shift End Time ---
        // Round to the nearest whole second (matches strip.py's generate_timeline_python) —
        // the old floor(hours) + round(minutes) approach could overflow, e.g.
        // working_hour=4.9999 -> round(0.9999*60)=60 silently added a bogus extra hour.
        const startSeconds = timeStringToSeconds(row.shift_start_time);
        const totalExtraSeconds = Math.round(row.working_hour * 3600);
        row.shift_end_time = secondsToTimeString(startSeconds + totalExtraSeconds);

        // --- Cumulative produced ---
        dailyProductionArray.push(row.planned_production_qty);
        row.strip_produced_qty = calculateStripProducedQty(dailyProductionArray);

        // --- Total Qty ---
        row.total_qty = calculateTotalQty(row.strip_pending_qty, row.strip_produced_qty);

        // --- Finalize ---
        counter++;
        safetyCounter++;
        stripPendingQty = row.strip_pending_qty;
        planned_qty += row.planned_production_qty;
        row.working_hour_day_capacity = Math.ceil(row.working_hour);

        rows.push(row);
    }

    return { timeline: rows, planned_qty };
}

/**
 * Filter a line's Daily Work Hour records and resolve which shift applies starting from a
 * given date — matches the backend's fetch_work_hour_data (strip.py): records on/after the
 * target date, ordered chronologically, first match's Shift wins.
 *
 * `.Date` is formatted "DD-MM-YYYY", so a plain string sort (`localeCompare`) is NOT
 * chronological — it sorts by day-of-month digit first, e.g. "20-01-2026" would sort after
 * "05-02-2026" even though January 20 is earlier. That silently picks the wrong shift
 * whenever a line's work-hour data spans multiple months, shifting every day's computed
 * start/end time by a fixed offset (the wrong shift's start time) while day-level date
 * rollover — which looks up each day by exact date match — stays correct. Sorting on the
 * ISO-equivalent key fixes this.
 *
 * @param {Array} dailyWorkHours - Daily Work Hour records (raw `Date: "DD-MM-YYYY"` strings)
 * @param {string} lineId
 * @param {Date} targetDate - the date scheduling should start from (e.g. the drop date)
 * @returns {{ lineWorkHours: Array, shiftName: string|null }}
 */
export function resolveLineWorkHours(dailyWorkHours, lineId, targetDate) {
    const toISO = (ddmmyyyy) => {
        const [d, m, y] = ddmmyyyy.split('-');
        return `${y}-${m}-${d}`;
    };
    const pad = (n) => String(n).padStart(2, '0');
    const targetISO = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;

    const lineWorkHours = dailyWorkHours
        .filter((d) => d.Line === lineId)
        .sort((a, b) => toISO(a.Date).localeCompare(toISO(b.Date)));

    if (lineWorkHours.length === 0) return { lineWorkHours, shiftName: null };

    const firstRelevant = lineWorkHours.find((d) => toISO(d.Date) >= targetISO) ?? lineWorkHours[0];
    return { lineWorkHours, shiftName: firstRelevant.Shift };
}

/**
 * Calculate timelines for multiple strips (sequential scheduling per line).
 *
 * @param {Array}  strips - From get_strips_with_learning_curve API
 * @param {Array}  dailyWorkHours - From get_daily_work_hours API
 * @param {Object} shiftMap - Map of shift name → shift detail object from get_shift_details
 *                            e.g. { "Day Shift": { name, startTime, endTime, durationHours } }
 *
 * @returns {Array} Strips enriched with .timeline and .planned_qty
 */
export function calculateStripTimelines(strips, dailyWorkHours, shiftMap) {
    return strips.map((strip) => {
        const { lineId } = strip;
        if (!lineId) return { ...strip, error: 'No Line ID' };

        // Trust the backend's own saved timeline (ERPNext's Strip Timeline Table) when it
        // exists, instead of recomputing live — Daily Work Hour data can change after a
        // strip was scheduled, so a live recompute can legitimately diverge from what was
        // actually saved even with byte-identical math. Only recompute when the backend
        // hasn't produced a timeline yet (e.g. a never-before-scheduled strip).
        if (Array.isArray(strip.strip_timeline_table) && strip.strip_timeline_table.length > 0) {
            return stripTimelineFromBackendTable(strip);
        }

        const { lineWorkHours, shiftName } = resolveLineWorkHours(
            dailyWorkHours, lineId, new Date(strip.sewingStartDate)
        );

        if (lineWorkHours.length === 0) {
            return stripTimelineFromBackendTable(strip);
        }

        const shiftData = shiftMap[shiftName];

        if (!shiftData) {
            return { ...strip, error: `Shift "${shiftName}" not found` };
        }

        const { timeline, planned_qty } = generateTimeline(strip, lineWorkHours, shiftData);

        return {
            ...strip,
            timeline,
            planned_qty,
            startDate: timeline.length > 0
                ? `${timeline[0].date} ${timeline[0].shift_start_time}`
                : null,
            endDate: timeline.length > 0
                ? `${timeline[timeline.length - 1].date} ${timeline[timeline.length - 1].shift_end_time}`
                : null,
        };
    });
}

function stripTimelineFromBackendTable(strip) {
    const timeline = (strip.strip_timeline_table || []).map((row) => ({
        date: row.date,
        day: new Date(row.date).toLocaleDateString('en-US', { weekday: 'long' }),
        shift_start_time: row.shift_start_time || '08:00:00',
        shift_end_time: row.shift_end_time || '17:00:00',
        working_hour_day_capacity: 0,
        working_hour: 0,
        man_power: strip.totalManpower || 0,
        efficiency: row.efficiency || 0,
        per_hour_qty: 0,
        target_qty_at_100_eff: 0,
        day_capacity: 0,
        planned_production_qty: row.planned_production_qty || 0,
        total_minutes: 0,
        strip_pending_qty: 0,
        strip_produced_qty: 0,
        total_qty: strip.totalQty || strip.quantity || 0,
    }));

    return {
        ...strip,
        timeline,
        planned_qty: strip.plannedQty || 0,
        startDate: timeline.length > 0
            ? `${timeline[0].date} ${timeline[0].shift_start_time}`
            : null,
        endDate: timeline.length > 0
            ? `${timeline[timeline.length - 1].date} ${timeline[timeline.length - 1].shift_end_time}`
            : null,
    };
}
