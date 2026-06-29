<script>
    import { getWorkHourData } from '$lib/api-call';
    import ContextMenu from '$lib/components/ContextMenu.svelte';
    import MergeTaskModal from '$lib/components/MergeTaskModal.svelte';
    import SplitTaskModal from '$lib/components/SplitTaskModal.svelte';
    import StripDetailsModal from '$lib/components/StripDetailsModal.svelte';
    import Task from '$lib/components/Task.svelte';
    import { onMount, tick } from 'svelte';

    // Props
    let { 
        tasks = $bindable([]),
        lines = [],
        today = new Date(),
        holidays = [],
        draggedUnplannedTask = null,
        workHoursData = $bindable([]),
        recalculateTask = null,
        onUnplannedDrop = () => {},
        onScroll = () => {},
        pendingUpdates = $bindable(new Set()),
        pendingSplits = $bindable([]),
        pendingMerges = $bindable([])
    } = $props();

    // Internal State
    let calendarDays = $state([]);
    let workHourDataList = []; // Plain array, no reactivity needed
    let workHourMap = new Map(); // Fast lookup cache
    let currentVisibleMonth = $state(''); // Track current visible month based on scroll
    
    // Constants - Calendar starts on today and shows 30 days forward
    let daysBefore = $state(0);  // Start on today (no days before)
    let daysAfter = $state(30);   // Show 30 days after today
    // Zoom State
    let dayColumnWidth = $state(140); // Reactive column width (was const DAY_COLUMN_WIDTH)
    const ZOOM_STEP = 40; // px per zoom step
    const ZOOM_MIN = 40;  // Minimum column width (~60 days visible = ~2 months)
    const ZOOM_MAX = 350; // Maximum column width (~4 days visible)

    function zoomIn() {
        // Larger columns = fewer days visible (min ~4 days)
        dayColumnWidth = Math.min(ZOOM_MAX, dayColumnWidth + ZOOM_STEP);
        tick().then(() => renderBoard());
    }

    function zoomOut() {
        // Smaller columns = more days visible (max ~2 months = ~60 days)
        dayColumnWidth = Math.max(ZOOM_MIN, dayColumnWidth - ZOOM_STEP);
        tick().then(() => renderBoard());
    }
    const ROW_HEIGHT = 36;
    const FOOTER_HEIGHT = 0; // Removed footer for compactness
    const START_HOUR = 8;
    const END_HOUR = 18;

    // Functions to load more days
    async function loadEarlierDays() {
        const startDateObj = new Date(today);
        startDateObj.setDate(startDateObj.getDate() - daysBefore - 30);
        const endDateObj = new Date(today);
        endDateObj.setDate(endDateObj.getDate() - daysBefore);
        
        daysBefore += 30;

        const newAPIWorkHourData = await getWorkHourData(formatDate(startDateObj, "YYYY-MM-DD"), formatDate(endDateObj, "YYYY-MM-DD"));
        if (newAPIWorkHourData && newAPIWorkHourData.length > 0) {
            workHoursData = [...workHoursData, ...newAPIWorkHourData];
        }
        renderBoard();
    }

    async function loadLaterDays() {
        const startDateObj = new Date(today);
        startDateObj.setDate(startDateObj.getDate() + daysAfter);
        const endDateObj = new Date(today);
        endDateObj.setDate(endDateObj.getDate() + daysAfter + 30);
        
        daysAfter += 30;

        const newAPIWorkHourData = await getWorkHourData(formatDate(startDateObj, "YYYY-MM-DD"), formatDate(endDateObj, "YYYY-MM-DD"));
        if (newAPIWorkHourData && newAPIWorkHourData.length > 0) {
            workHoursData = [...workHoursData, ...newAPIWorkHourData];
        }
        renderBoard();
    }

    // Reset to today view (today + 30 days) - called when TODAY is clicked
    export function resetToToday() {
        daysBefore = 0;
        daysAfter = 30;
        renderBoard();
    }

    // Scroll the calendar so a given task is visible and centred horizontally
    export async function scrollToTask(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.start) return;

        const taskStart = new Date(task.start);
        const calStart = new Date(today);
        calStart.setHours(0, 0, 0, 0);
        calStart.setDate(calStart.getDate() - daysBefore);

        const calEnd = new Date(today);
        calEnd.setHours(0, 0, 0, 0);
        calEnd.setDate(calEnd.getDate() + daysAfter);

        // Expand range if the task start is outside the current calendar window
        let needsRender = false;
        if (taskStart < calStart) {
            const diffDays = Math.ceil((calStart - taskStart) / (1000 * 60 * 60 * 24));
            daysBefore += diffDays + 7; // extra buffer
            needsRender = true;
        } else if (taskStart > calEnd) {
            const diffDays = Math.ceil((taskStart - calEnd) / (1000 * 60 * 60 * 24));
            daysAfter += diffDays + 7;
            needsRender = true;
        }

        if (needsRender) {
            renderBoard();
            await tick();
        }

        const body = document.getElementById('calendar-body');
        if (!body) return;

        const xOffset = getPixelOffsetForDate(taskStart, task.lineId);
        const lineIndex = lines.findIndex(l => l.id === task.lineId);
        const yOffset = lineIndex >= 0 ? lineIndex * ROW_HEIGHT : 0;

        // Centre the task horizontally in the viewport
        const centredX = xOffset - body.clientWidth / 2 + dayColumnWidth;
        body.scrollTo({ left: Math.max(0, centredX), top: yOffset, behavior: 'smooth' });

        // Flash highlight via a temporary class on the task DOM node
        await tick();
        const taskEl = body.querySelector(`[data-task-id="${taskId}"]`);
        if (taskEl) {
            taskEl.classList.add('task-highlight-flash');
            setTimeout(() => taskEl.classList.remove('task-highlight-flash'), 1800);
        }
    }

    // Drag & Drop State
    let draggedTaskId = null;
    let isDragging = $state(false); // Reactive state for drag status
    let originalLineId = null;
    let draggedTaskDuration = 0;
    let draggedTaskOffsetLeft = 0;
    let draggedTaskDurationMs = 0;
    let ghostTaskElement = null;
    let dragOutlineElement = null; // Positioned overlay for cell highlight (no class toggling)
    // Cached DOM refs for drag performance (avoid getBoundingClientRect on every dragover)
    let cachedGridRect = null;
    let cachedCalendarBody = null;
    // RAF-based drag throttling (cap visual updates to 1 per animation frame)
    let dragOverRAF = null;
    let lastDragClientX = 0;
    let lastDragClientY = 0;
    // Cell-change cache: skip heavy validation when still hovering same cell
    let lastValidatedDayIndex = -1;
    let lastValidatedLineIndex = -1;
    let gridListenersAttached = false;

    // Context Menu & Split Modal State
    let showContextMenu = $state(false);
    let contextMenuX = $state(0);
    let contextMenuY = $state(0);
    let selectedTaskForContext = $state(null);
    let showSplitModal = $state(false);
    let selectedTaskForSplit = $state(null);
    let showMergeModal = $state(false);
    let selectedTaskForMerge = $state(null);
    let mergeCandidates = $state([]);
    let showStripDetailsModal = $state(false);
    let selectedTaskForDetails = $state(null);
    let showDateTimeModal = $state(false);
    let selectedTaskForDateTime = $state(null);
    let dateTimeModalValue = $state(''); // YYYY-MM-DD
    let dateTimeTimeValue = $state('08:00'); // HH:MM

    // Helpers
    function getStandardWorkHours(dayOfWeek) {
        switch (dayOfWeek) {
            case 0: return 9; // Sunday (Shorter day)
            case 5: return 0; // Friday (Weekend)
            case 6: return 0; // Saturday (Weekend)
            default: return 10; // Weekday (Mon-Thurs)
        }
    }
// On this nav bar thare is a search field. I want to search by order id and style id and if the search is found, then it should show as drop down button of the search input filed and if I click on the search result, then
    

    function getLineWorkHours(date, lineId, isBlocked = null) {
        // 1. Check if it's a blocked day (weekend/holiday)
        const dateStr = formatDate(date, 'YYYY-MM-DD');
        if (isBlocked === true) return 0;
        
        if (isBlocked === null) {
            const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
            if (day && day.isBlocked) return 0;
        }

        // Convert date format from YYYY-MM-DD to DD-MM-YYYY for API data
        let date_ = `${dateStr.split('-')[2]}-${dateStr.split('-')[1]}-${dateStr.split('-')[0]}`;
        
        const workHourData = workHourMap.get(`${lineId}_${date_}`);
        
        if (workHourData) {
            return workHourData.WorkHour || 0;
        } else {
            // No API data for this line/date — treat as a working day (default 10h)
            return 10;
        }
    }

    function formatDate(date, format) {
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

    function getPixelOffsetForDate(date, lineId) {
        if (!calendarDays.length) return 0;

        const calendarStart = new Date(calendarDays[0].date);
        // Normalize to start of day? No, keep time precision for accurate linear mapping
        // calendarStart is likely 00:00 if constructed that way.
        // Let's ensure strict linear mapping based on timestamps.
        
        const dateObj = new Date(date);
        
        // Calculate difference in milliseconds
        const diffMs = dateObj.getTime() - calendarStart.getTime();
        
        // Convert to days (float)
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        return diffDays * dayColumnWidth;
    }

    function getTaskStyle(task) {
        const taskStart = new Date(task.start);
        const taskEnd = new Date(task.end);
        const lineIndex = lines.findIndex(l => l.id === task.lineId);

        if (lineIndex === -1) return '';

        const startPixel = getPixelOffsetForDate(taskStart, task.lineId);
        if (startPixel === null) return '';

        let endPixel = getPixelOffsetForDate(taskEnd, task.lineId);
        if (endPixel === null) {
            const lastDayIndex = calendarDays.length - 1;
            endPixel = (lastDayIndex * dayColumnWidth) + dayColumnWidth;
        }

        const width = endPixel - startPixel;
        if (width <= 0) return '';

        // NEW: Split row layout (Tasks in top 70%)
        const TASK_HEIGHT_PERCENT = 0.7;
        const top = (lineIndex * ROW_HEIGHT) + 2; // small 2px padding
        const height = (ROW_HEIGHT * TASK_HEIGHT_PERCENT) - 4; // padding adjustment
        
        return `left: ${startPixel}px; top: ${top}px; width: ${width}px; height: ${height}px;`;
    }


    // Returns segments (left offset relative to task start, width) for any blocked days the task crosses.
    // Covers both weekends AND holidays (isBlocked = isWeekend || isHoliday).
    function getHolidaySegments(task) {
        const taskStart = new Date(task.start);
        const taskEnd = new Date(task.end);
        const lineIndex = lines.findIndex(l => l.id === task.lineId);
        if (lineIndex === -1) return [];

        const taskStartPixel = getPixelOffsetForDate(taskStart, task.lineId);
        const segments = [];

        for (const day of calendarDays) {
            // Match any blocked day or 0 work hour day for this line
            const workHours = getLineWorkHours(day.date, task.lineId, day.isBlocked);
            if (!day.isBlocked && workHours > 0) continue;

            // Check if the holiday day overlaps with the task range
            const dayStart = new Date(day.date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);

            if (dayEnd <= taskStart || dayStart >= taskEnd) continue;

            // Compute the column's absolute pixel position
            const dayPixel = getPixelOffsetForDate(dayStart, task.lineId);
            const leftRelToTask = dayPixel - taskStartPixel;

            // Clamp to the task's own width bounds
            const taskStartPixel2 = getPixelOffsetForDate(taskStart, task.lineId);
            const taskEndPixel = getPixelOffsetForDate(taskEnd, task.lineId);
            const taskWidth = taskEndPixel - taskStartPixel2;

            const segLeft = Math.max(0, leftRelToTask);
            const segRight = Math.min(taskWidth, leftRelToTask + dayColumnWidth);
            if (segRight <= segLeft) continue;

            segments.push({
                left: segLeft,
                width: segRight - segLeft,
                top: (lineIndex * ROW_HEIGHT) + 2,
                height: (ROW_HEIGHT * 0.7) - 4,
                taskLeftPixel: taskStartPixel
            });
        }
        return segments;
    }

    function calculateNewEndDate(newStartDate, workDurationMinutes, lineId) {
        let minutesToDistribute = workDurationMinutes;
        let newEndDate = new Date(newStartDate);
        let dateStr = formatDate(newStartDate, 'YYYY-MM-DD');
        let currentDayIndex = calendarDays.findIndex(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

        if (currentDayIndex === -1) {
            console.error("Could not find start day in calendar");
            return newStartDate; // Failsafe
        }

        while (minutesToDistribute > 0 && currentDayIndex < calendarDays.length) {
            const currentDay = calendarDays[currentDayIndex];
            const workHours = getLineWorkHours(currentDay.date, lineId);
            
            if (!currentDay.isBlocked && workHours > 0) {
                const dayWorkStart = new Date(currentDay.date);
                dayWorkStart.setHours(START_HOUR, 0, 0, 0);
                
                const dayWorkEnd = new Date(dayWorkStart.getTime() + workHours * 60 * 60000);

                // Start time for this day's calculation
                const calcStart = new Date(Math.max(newEndDate.getTime(), dayWorkStart.getTime()));

                // Minutes available in the rest of *this* day
                let minutesAvailable = (dayWorkEnd.getTime() - calcStart.getTime()) / (1000 * 60);
                
                if (minutesAvailable <= 0) {
                    currentDayIndex++;
                    // Set newEndDate to start of next work day (or just next day)
                    if (currentDayIndex < calendarDays.length) {
                        newEndDate = new Date(calendarDays[currentDayIndex].date);
                        newEndDate.setHours(START_HOUR, 0, 0, 0);
                    }
                    continue;
                }

                if (minutesToDistribute <= minutesAvailable) {
                    // Task finishes on this day
                    newEndDate = new Date(calcStart.getTime() + minutesToDistribute * 60000);
                    minutesToDistribute = 0;
                } else {
                    // Task continues to next day
                    minutesToDistribute -= minutesAvailable;
                    newEndDate = new Date(dayWorkEnd); // End of this day becomes start for next loop
                    currentDayIndex++;
                }
            } else {
                // Skip blocked day
                currentDayIndex++;
                // Set newEndDate to the start of this non-work day to ensure calcStart on next loop is correct
                if (currentDayIndex < calendarDays.length) {
                    newEndDate = new Date(calendarDays[currentDayIndex].date);
                    newEndDate.setHours(START_HOUR, 0, 0, 0);
                }
            }
        }
        return newEndDate;
    }

    function isOverlapping(taskIdToIgnore, lineId, newStart, newEnd) {
        // Check against all tasks on the *same line*
        const tasksOnLine = tasks.filter(t => t.lineId === lineId && t.id !== taskIdToIgnore);
        
        for (const task of tasksOnLine) {
            const existingStart = new Date(task.start);
            const existingEnd = new Date(task.end);

            // Standard collision detection logic
            if (newStart < existingEnd && newEnd > existingStart) {
                return true; // Overlap found
            }
        }
        return false; // No overlap
    }

    // Drag Handlers
    function handleDragStart(e, taskPtr) {
        if (!taskPtr) {
            console.error("Drag start called without task object.");
            e.preventDefault();
            return;
        }

        draggedTaskId = taskPtr.id;
        // Verify we have the latest task state from the array (in case taskPtr is stale, though unlikely in this flow)
        const task = tasks.find(t => t.id === draggedTaskId) || taskPtr;
        
        originalLineId = task.lineId;
        
        const taskRect = e.target.getBoundingClientRect();
        // Cache grid rect and body element for the entire drag (avoids reflow on every dragover)
        cachedGridRect = document.getElementById('calendar-grid').getBoundingClientRect();
        cachedCalendarBody = document.getElementById('calendar-body');
        // Calculate where the user clicked relative to the task's left edge
        const taskOffsetLeft = e.clientX - taskRect.left;
        draggedTaskOffsetLeft = taskOffsetLeft;

        const taskStart = new Date(task.start);
        const taskEnd = new Date(task.end);

        // ABSOLUTE DURATION: Simple difference
        const durationMs = taskEnd.getTime() - taskStart.getTime();
        draggedTaskDurationMs = durationMs;

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            id: draggedTaskId,
            durationMs: durationMs,
            taskOffsetLeft: taskOffsetLeft
        }));

        // Use a small compact pill as the native drag ghost instead of cloning the
        // full task element (which can be thousands of pixels wide for long tasks).
        const draggedTask = tasks.find(t => t.id === draggedTaskId) || taskPtr;
        const dragImage = document.createElement('div');
        dragImage.style.cssText = [
            'position:absolute',
            'top:-9999px',
            'left:0',
            'width:160px',
            'height:28px',
            'background:#3b82f6',
            'border:1px solid #1d4ed8',
            'border-radius:6px',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'color:#fff',
            'font-size:12px',
            'font-weight:600',
            'padding:0 10px',
            'box-shadow:0 4px 12px rgba(0,0,0,0.25)',
            'white-space:nowrap',
            'overflow:hidden',
            'pointer-events:none',
        ].join(';');
        dragImage.textContent = draggedTask?.orderId || draggedTask?.id || 'Task';
        document.body.appendChild(dragImage);

        e.dataTransfer.setDragImage(dragImage, 80, 14); // center of the pill

        setTimeout(() => {
            if (dragImage.parentNode) dragImage.parentNode.removeChild(dragImage);
        }, 100);

        // Disable pointer-events on all tasks during drag so events reach grid cells.
        // Controlled reactively via isDragging passed to Task components.
        // We use setTimeout to ensure the browser has fully initialized the drag operation
        // before we modify the element's pointer-events.
        setTimeout(() => {
            isDragging = true;
        }, 0);

        if (ghostTaskElement) ghostTaskElement.remove();
        if (dragOutlineElement) dragOutlineElement.remove();

        ghostTaskElement = document.createElement('div');
        ghostTaskElement.id = 'ghost-task';
        ghostTaskElement.style.position = 'absolute';
        ghostTaskElement.style.left = '0';
        ghostTaskElement.style.top = '0';
        ghostTaskElement.style.pointerEvents = 'none';
        ghostTaskElement.style.willChange = 'transform';
        ghostTaskElement.style.opacity = '0.5';
        ghostTaskElement.style.backgroundColor = '#60a5fa'; // blue-400 — matches task colour
        ghostTaskElement.style.border = '2px dashed #1d4ed8'; // blue-700
        ghostTaskElement.style.borderRadius = '0.25rem';
        ghostTaskElement.style.zIndex = '20';

        // Use the found element (root)
        const sourceEl = e.target.closest('.task') || e.target;

        const height = ROW_HEIGHT - FOOTER_HEIGHT - 10;
        ghostTaskElement.style.width = sourceEl.style.width;
        ghostTaskElement.style.height = `${height}px`;
        ghostTaskElement.classList.add('valid');

        // Create outline overlay (positioned element, moves with ghost — no class toggling)
        dragOutlineElement = document.createElement('div');
        dragOutlineElement.id = 'drag-outline';
        dragOutlineElement.style.position = 'absolute';
        dragOutlineElement.style.zIndex = '5';
        dragOutlineElement.style.pointerEvents = 'none';
        dragOutlineElement.style.willChange = 'transform';
        dragOutlineElement.style.width = `${dayColumnWidth}px`;
        dragOutlineElement.style.height = `${ROW_HEIGHT}px`;
        dragOutlineElement.style.outline = '2px dashed #0ea5e9';
        dragOutlineElement.style.backgroundColor = 'rgba(224, 242, 254, 0.5)';
        dragOutlineElement.style.boxSizing = 'border-box';
        dragOutlineElement.style.boxSizing = 'border-box';
        // Initial position matching task
        const initDayIndex = Math.floor(parseFloat(sourceEl.style.left) / dayColumnWidth);
        const lineIndex = lines.findIndex(l => l.id === task.lineId);
        
        // GPU Acceleration: Use transform instead of left/top
        dragOutlineElement.style.left = '0';
        dragOutlineElement.style.top = '0';
        dragOutlineElement.style.transform = `translate3d(${initDayIndex * dayColumnWidth}px, ${lineIndex * ROW_HEIGHT}px, 0)`;

        // Append both to grid
        const grid = document.getElementById('calendar-grid');
        if (grid) {
            grid.appendChild(ghostTaskElement);
            grid.appendChild(dragOutlineElement);
        }
    }

    function createGhostTask(width, top, left, label = '') {
        ghostTaskElement = document.createElement('div');
        ghostTaskElement.id = 'ghost-task';
        ghostTaskElement.style.pointerEvents = 'none';
        ghostTaskElement.style.willChange = 'transform';
        ghostTaskElement.style.opacity = '0.5';

        // Match standard task styling for unplanned ghost
        ghostTaskElement.style.position = 'absolute';
        ghostTaskElement.style.backgroundColor = '#60a5fa'; // blue-400 — matches task colour
        ghostTaskElement.style.border = '2px dashed #1d4ed8'; // blue-700
        ghostTaskElement.style.borderRadius = '0.375rem'; // rounded-md
        
        ghostTaskElement.style.width = width;
        ghostTaskElement.style.width = width;
        // GPU Acceleration
        ghostTaskElement.style.left = '0';
        ghostTaskElement.style.top = '0';
        ghostTaskElement.style.transform = `translate3d(${left}, ${top}, 0)`;
        const height = ROW_HEIGHT - FOOTER_HEIGHT - 10; // Match task height calculation
        ghostTaskElement.style.height = `${height}px`;
        ghostTaskElement.classList.add('valid');
        ghostTaskElement.style.zIndex = '50'; // Ensure it's above grid lines but below some overlays

        if (label) {
             ghostTaskElement.textContent = label;
             ghostTaskElement.style.display = 'flex';
             ghostTaskElement.style.alignItems = 'center';
             ghostTaskElement.style.justifyContent = 'center';
             ghostTaskElement.style.color = '#fff';
             ghostTaskElement.style.fontSize = '12px';
             ghostTaskElement.style.overflow = 'hidden';
        }

        const grid = document.getElementById('calendar-grid');
        if (grid) {
            grid.appendChild(ghostTaskElement);
        }
    }

    function handleDragOver(e) {
        e.preventDefault();

        // Capture mouse coords synchronously (event object may be recycled)
        lastDragClientX = e.clientX;
        lastDragClientY = e.clientY;

        // --- UNPLANNED TASK GHOST CREATION (one-time, must be synchronous) ---
        if (!draggedTaskId && draggedUnplannedTask && !ghostTaskElement) {
             const estimatedWidth = (draggedUnplannedTask.total_days || 1) * dayColumnWidth;
             // Always re-read live — grid rect changes as the user scrolls
             const _body = document.getElementById('calendar-body');
             const _gridRect = document.getElementById('calendar-grid').getBoundingClientRect();
             cachedGridRect = _gridRect;
             cachedCalendarBody = _body;
             // relX must include scroll offset so ghost appears under the cursor
             const relX = e.clientX - _gridRect.left + (_body ? _body.scrollLeft : 0);
             const relY = e.clientY - _gridRect.top;
             createGhostTask(`${estimatedWidth}px`, `${relY}px`, `${relX}px`);
        }

        // Throttle all visual updates to one per animation frame
        if (dragOverRAF) return;
        dragOverRAF = requestAnimationFrame(processDragOver);
    }

    function processDragOver() {
        dragOverRAF = null;

        if (!ghostTaskElement) return;

        // Always read live: viewport rect shifts as the user scrolls
        const calBody = cachedCalendarBody || document.getElementById('calendar-body');
        if (!cachedCalendarBody) cachedCalendarBody = calBody;
        // Use calendar-body as the reference (fixed in viewport), then add scrollLeft
        // to get absolute pixel position within the grid.
        const bodyRect = calBody ? calBody.getBoundingClientRect() : { left: 0, top: 0 };
        const scrollLeft = calBody ? calBody.scrollLeft : 0;

        const relY = lastDragClientY - bodyRect.top;
        const lineIndex = Math.floor(relY / ROW_HEIGHT);

        if (lineIndex < 0 || lineIndex >= lines.length) return;

        const newLineId = lines[lineIndex].id;

        let activeTaskId = draggedTaskId;
        let durationMs = draggedTaskDurationMs;
        let taskOffsetLeft = draggedTaskOffsetLeft;

        if (!activeTaskId && draggedUnplannedTask) {
             activeTaskId = draggedUnplannedTask.id;
             if (!durationMs) {
                durationMs = (draggedUnplannedTask.total_days || 1) * 24 * 60 * 60 * 1000;
             }
        }

        const mouseX = (lastDragClientX - bodyRect.left) + scrollLeft;
        const taskLeftPixel = mouseX - taskOffsetLeft;

        const dayIndexFloat = taskLeftPixel / dayColumnWidth;
        // Clamp to left edge (day 0) instead of rejecting: fixes "can't drop at first day's left edge"
        const dayIndex = Math.max(0, Math.floor(dayIndexFloat));

        if (dayIndex >= calendarDays.length) {
            ghostTaskElement.classList.remove('valid');
            ghostTaskElement.classList.add('invalid');
            if (dragOutlineElement) dragOutlineElement.style.display = 'none';
            return;
        }

        // --- POSITION ghost + outline (runs every frame for smooth movement) ---
        const ghostHeight = ROW_HEIGHT - FOOTER_HEIGHT - 10;
        const newTop = Math.min((lineIndex * ROW_HEIGHT) + 10, (lines.length - 1) * ROW_HEIGHT);
        const durationDays = durationMs / (1000 * 60 * 60 * 24);
        const newWidth = durationDays * dayColumnWidth;

        // Clamp ghost so it stays within the grid (left edge ≥ 0, right edge ≤ grid total width)
        const gridTotalWidth = calendarDays.length * dayColumnWidth;
        const clampedTaskLeftPixel = Math.min(Math.max(0, taskLeftPixel), Math.max(0, gridTotalWidth - newWidth));
        ghostTaskElement.style.width = `${newWidth}px`;
        ghostTaskElement.style.height = `${ghostHeight}px`;
        ghostTaskElement.style.transform = `translate3d(${clampedTaskLeftPixel}px, ${newTop}px, 0)`;

        if (dragOutlineElement) {
            dragOutlineElement.style.transform = `translate3d(${dayIndex * dayColumnWidth}px, ${lineIndex * ROW_HEIGHT}px, 0)`;
            dragOutlineElement.style.display = '';
        }

        // --- VALIDATION: only re-run when hovering a different cell ---
        if (dayIndex !== lastValidatedDayIndex || lineIndex !== lastValidatedLineIndex) {
            lastValidatedDayIndex = dayIndex;
            lastValidatedLineIndex = lineIndex;

            const leftEdgeDay = calendarDays[dayIndex];
            const isWeekendStart = leftEdgeDay.dayOfWeek === 5 || leftEdgeDay.dayOfWeek === 6;
            const workHours = getLineWorkHours(leftEdgeDay.date, newLineId, leftEdgeDay.isBlocked);
            const isLeftEdgeBlocked = isWeekendStart || leftEdgeDay.isBlocked || workHours === 0;

            // dayIndexFloat may be < dayIndex when clamped; clamp fraction to [0,1)
            const dayFraction = Math.max(0, dayIndexFloat - Math.floor(dayIndexFloat));
            const minutesIntoDay = dayFraction * 24 * 60;
            const newStartDate = new Date(leftEdgeDay.date.getTime() + minutesIntoDay * 60 * 1000);
            const newEndDate = new Date(newStartDate.getTime() + durationMs);

            const hasOverlap = isOverlapping(activeTaskId, newLineId, newStartDate, newEndDate);

            if (isLeftEdgeBlocked || hasOverlap) {
                ghostTaskElement.classList.remove('valid');
                ghostTaskElement.classList.add('invalid');
                if (dragOutlineElement) {
                    dragOutlineElement.style.outline = '2px dashed #ef4444';
                    dragOutlineElement.style.backgroundColor = 'rgba(254, 226, 226, 0.5)';
                }
            } else {
                ghostTaskElement.classList.remove('invalid');
                ghostTaskElement.classList.add('valid');
                if (dragOutlineElement) {
                    dragOutlineElement.style.outline = '2px dashed #0ea5e9';
                    dragOutlineElement.style.backgroundColor = 'rgba(224, 242, 254, 0.5)';
                }
            }
        }
    }

    function handleDragEnd(e) {
        // Cancel any pending RAF to prevent stale updates
        if (dragOverRAF) {
            cancelAnimationFrame(dragOverRAF);
            dragOverRAF = null;
        }

        if (ghostTaskElement) {
            ghostTaskElement.remove();
            ghostTaskElement = null;
        }
        if (dragOutlineElement) {
            dragOutlineElement.remove();
            dragOutlineElement = null;
        }

        // Re-enable pointer-events on tasks
        isDragging = false;

        draggedTaskId = null;
        originalLineId = null;
        draggedTaskOffsetLeft = 0;
        draggedTaskDurationMs = 0;
        cachedGridRect = null;
        cachedCalendarBody = null;
        lastValidatedDayIndex = -1;
        lastValidatedLineIndex = -1;
    }

    function handleDragLeave(e) {
        // Don't remove drag-over here — handleDragOver manages the outline
        // based on the ghost task's left edge position, not the mouse position.
        // Cleanup is handled by handleDragEnd when the drag finishes.
    }

    // Context Menu Handlers (use clientX/clientY so menu appears at cursor/task with position:fixed)
    function handleTaskContextMenu(e, task) {
        e.preventDefault();
        e.stopPropagation();
        
        selectedTaskForContext = task;
        contextMenuX = e.clientX;
        contextMenuY = e.clientY;
        showContextMenu = true;
    }

    function handleContextMenuItemClick(item) {
        if (item.id === 'split' && selectedTaskForContext) {
            selectedTaskForSplit = selectedTaskForContext;
            showSplitModal = true;
        } else if (item.id === 'merge' && selectedTaskForContext) {
             // Filter candidates: same customer AND same style
             // style in task is formatted as "Style (Color)", so we might need to extract the base style
             const getBaseStyle = (s) => s.split(' (')[0];
             const sourceBaseStyle = getBaseStyle(selectedTaskForContext.style);

             mergeCandidates = tasks.filter(t => 
                 t.id !== selectedTaskForContext.id && 
                 t.customer === selectedTaskForContext.customer &&
                 getBaseStyle(t.style) === sourceBaseStyle
             );
            
            selectedTaskForMerge = selectedTaskForContext;
            const candidates = tasks.filter(t => t.id !== selectedTaskForContext.id);
            mergeCandidates = candidates;
            showMergeModal = true;
        } else if (item.id === 'strip-details' && selectedTaskForContext) {
            selectedTaskForDetails = selectedTaskForContext;
            showStripDetailsModal = true;
        } else if (item.id === 'update-datetime' && selectedTaskForContext) {
            selectedTaskForDateTime = selectedTaskForContext;
            if (selectedTaskForContext.start) {
                const d = new Date(selectedTaskForContext.start);
                dateTimeModalValue = selectedTaskForContext.start.slice(0, 10);
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                dateTimeTimeValue = `${hh}:${mm}`;
            } else {
                dateTimeModalValue = '';
                dateTimeTimeValue = '08:00';
            }
            showDateTimeModal = true;
        }
        showContextMenu = false;
    }

    function handleContextMenuClose() {
        showContextMenu = false;
        selectedTaskForContext = null;
    }

    function applyDateTimeChange() {
        if (!selectedTaskForDateTime || !dateTimeModalValue) return;
        const task = tasks.find(t => t.id === selectedTaskForDateTime.id);
        if (!task) return;

        const timeStr = dateTimeTimeValue || '00:00';
        const newStart = new Date(`${dateTimeModalValue}T${timeStr}:00`);
        if (isNaN(newStart.getTime())) return;

        if (recalculateTask) {
            const result = recalculateTask(task, newStart, task.lineId);
            task.start = result.start;
            task.end = result.end;
            task.timeline = result.timeline;
            task.total_days = result.total_days;
        } else {
            // Fallback: shift the end date by the same offset
            const oldStart = new Date(task.start);
            const delta = newStart - oldStart;
            const newEnd = new Date(new Date(task.end).getTime() + delta);
            task.start = newStart.toISOString();
            task.end = newEnd.toISOString();
        }

        pendingUpdates.add(task.id);
        showDateTimeModal = false;
        selectedTaskForDateTime = null;
    }

    function handleSplitTask({ splitQuantity }) {
        if (!selectedTaskForSplit) return;

        const originalTask = tasks.find(t => t.id === selectedTaskForSplit.id);
        if (!originalTask) return;

        // 1. Capture original timing before any changes
        const oldQuantity = originalTask.quantity;
        const newOriginalQuantity = oldQuantity - splitQuantity;
        
        if (newOriginalQuantity <= 0) {
            console.error("Cannot split more than available quantity");
            return;
        }

        const originalStartDate = new Date(originalTask.start);
        const originalEndDate = new Date(originalTask.end);
        const originalDurationMs = originalEndDate.getTime() - originalStartDate.getTime();

        // 2. Calculate proportional durations based on quantity ratios
        const originalRatio = newOriginalQuantity / oldQuantity;
        const splitRatio = splitQuantity / oldQuantity;

        // 3. Update original task quantity
        originalTask.quantity = newOriginalQuantity;

        // 4. Recalculate ORIGINAL task timeline based on its reduced quantity.
        // Important: preserve the original start — recalculateTask may snap it
        // to a work-day boundary which would shift the task backward visually.
        let originalRecalculated = false;
        if (recalculateTask) {
            const startDate = new Date(originalTask.start);
            const result = recalculateTask(originalTask, startDate, originalTask.lineId);
            
            // Check if recalculateTask actually scaled the duration (real calculator)
            // vs just preserving the old duration (fallback mode).
            // In fallback mode, the duration stays the same as old, so we need to fix it.
            const resultEnd = new Date(result.end);
            const resultDuration = resultEnd.getTime() - startDate.getTime();
            
            // If duration is roughly the same as original (fallback didn't scale),
            // apply proportional scaling instead
            if (Math.abs(resultDuration - originalDurationMs) < 60000) {
                // Fallback mode detected — scale proportionally
                const scaledDurationMs = originalDurationMs * originalRatio;
                const scaledEnd = new Date(originalStartDate.getTime() + scaledDurationMs);
                originalTask.end = scaledEnd.toISOString();
                originalTask.timeline = result.timeline;
                originalTask.total_days = Math.max(1, Math.round((result.total_days || 1) * originalRatio));
            } else {
                // Real calculator produced a different (correct) duration
                originalTask.end = result.end;
                originalTask.timeline = result.timeline;
                originalTask.total_days = result.total_days;
                originalRecalculated = true;
            }
        }

        // 5. Build new split task starting right after the original ends
        const newTaskId = `${originalTask.id}-split-${Date.now()}`;
        const newTaskStart = new Date(originalTask.end);

        // Create a temporary task object for the split portion
        const splitTaskDraft = {
            ...originalTask,
            id: newTaskId,
            quantity: splitQuantity,
            completed_quantity: 0,
            completed_segments: []
        };

        // 6. Calculate split task end date
        let newTaskStart_Calculated = new Date(newTaskStart);
        let newTaskEnd = new Date(newTaskStart);
        newTaskEnd.setDate(newTaskEnd.getDate() + 2); // fallback
        let splitTimeline = [];
        let splitTotalDays = 2;

        if (recalculateTask) {
            const splitResult = recalculateTask(splitTaskDraft, newTaskStart, originalTask.lineId);
            newTaskStart_Calculated = new Date(splitResult.start);
            newTaskEnd = new Date(splitResult.end);
            splitTimeline = splitResult.timeline || [];
            splitTotalDays = splitResult.total_days || 2;

            // If the real calculator wasn't used (fallback), scale proportionally
            if (!originalRecalculated) {
                const splitDurationMs = originalDurationMs * splitRatio;
                newTaskEnd = new Date(newTaskStart.getTime() + splitDurationMs);
                splitTotalDays = Math.max(1, Math.round((originalTask.total_days || 1) * (splitQuantity / newOriginalQuantity)));
            }
        }

        const newTask = {
            ...splitTaskDraft,
            start: newTaskStart_Calculated.toISOString(),
            end: newTaskEnd.toISOString(),
            timeline: splitTimeline,
            total_days: splitTotalDays,
            total_working_days: splitTotalDays
        };

        // Adjust completed_quantity of original if it exceeds new quantity
        if (originalTask.completed_quantity > originalTask.quantity) {
            originalTask.completed_quantity = originalTask.quantity;
        }

        // Add to new task to tasks array
        tasks.push(newTask);
        tasks = [...tasks]; // Trigger reactivity

        // Track split action for backend
        pendingSplits.push({
            originalId: selectedTaskForSplit.id,
            splitQuantity: splitQuantity,
            newId: newTaskId,
            lineId: originalTask.lineId,
            floorId: lines.find(l => l.id === originalTask.lineId)?.parentId,
            sewingStartDate: newTask.start,
            deliveryDate: newTask.end
        });
        pendingSplits = [...pendingSplits]; // Trigger reactivity

        // Also track original as updated (quantity changed)
        pendingUpdates.add(selectedTaskForSplit.id);

        console.log('Tasks after split:', JSON.parse(JSON.stringify(tasks)));

        // Close modal and reset state
        showSplitModal = false;
        selectedTaskForSplit = null;
    }

    function handleSplitModalCancel() {
        showSplitModal = false;
        selectedTaskForSplit = null;
    }

// --- GAP FILLER STATE & FUNCTIONS ---
    let selectedTaskIdsForGap = $state(new Set());

    // Computed lists using Svelte 5 derived state
    const selectedTasksList = $derived(
        tasks.filter(t => selectedTaskIdsForGap.has(t.id))
    );

    const canFillGap = $derived(
        selectedTasksList.length === 2 && 
        selectedTasksList[0].lineId === selectedTasksList[1].lineId
    );

    function toggleTaskSelectionForGap(taskId) {
        if (selectedTaskIdsForGap.has(taskId)) {
            selectedTaskIdsForGap.delete(taskId);
        } else {
            if (selectedTaskIdsForGap.size >= 2) {
                const firstElement = selectedTaskIdsForGap.values().next().value;
                selectedTaskIdsForGap.delete(firstElement);
            }
            selectedTaskIdsForGap.add(taskId);
        }
        selectedTaskIdsForGap = new Set(selectedTaskIdsForGap);
    }

    function clearGapSelection() {
        selectedTaskIdsForGap = new Set();
    }

    function fillGapBetweenStrips() {
        if (!canFillGap) return;

        // Sort tasks chronologically by start date
        const sortedSelected = [...selectedTasksList].sort((a, b) => new Date(a.start) - new Date(b.start));
        const firstTask = sortedSelected[0];
        const secondTask = sortedSelected[1];

        const taskToUpdate = tasks.find(t => t.id === secondTask.id);
        if (!taskToUpdate) return;

        // 2nd strip start time moves to 1st strip end time
        const newStart = new Date(firstTask.end);

        if (recalculateTask) {
            const result = recalculateTask(taskToUpdate, newStart, taskToUpdate.lineId);
            taskToUpdate.start = result.start;
            taskToUpdate.end = result.end;
            taskToUpdate.timeline = result.timeline;
            taskToUpdate.total_days = result.total_days;
            taskToUpdate.total_working_days = result.total_days;
        } else {
            const oldStart = new Date(taskToUpdate.start);
            const delta = newStart - oldStart;
            const newEnd = new Date(new Date(taskToUpdate.end).getTime() + delta);
            taskToUpdate.start = newStart.toISOString();
            taskToUpdate.end = newEnd.toISOString();
        }

        pendingUpdates.add(taskToUpdate.id);
        tasks = [...tasks];
        clearGapSelection();
    }

    // --- TODAY'S TIMELINE HIGHLIGHT GEOMETRY ---
    // Finds where Today's column starts (X coordinate) and how wide it is
    const todayColumnGeometry = $derived(() => {
        if (!calendarDays || calendarDays.length === 0) return null;
        
        // Find the index of the day marked as today
        const todayIndex = calendarDays.findIndex(d => d.isToday);
        if (todayIndex === -1) return null;

        return {
            leftPixel: todayIndex * dayColumnWidth,
            widthPixel: dayColumnWidth
        };
    });

    // Helper function to determine if a task overlaps with today's date
    function isTaskActiveToday(task) {
        if (!task.start || !task.end) return false;
        const taskStart = new Date(task.start);
        const taskEnd = new Date(task.end);
        const currentToday = new Date(today);
        
        // Set times to midnight for clean calendar date comparisons
        const s = new Date(taskStart.getFullYear(), taskStart.getMonth(), taskStart.getDate());
        const e = new Date(taskEnd.getFullYear(), taskEnd.getMonth(), taskEnd.getDate());
        const t = new Date(currentToday.getFullYear(), currentToday.getMonth(), currentToday.getDate());
        
        return t >= s && t <= e;
    }

    function handleMergeTask(targetTask) {
        if (!selectedTaskForMerge || !targetTask) return;

        const sourceTask = tasks.find(t => t.id === selectedTaskForMerge.id);
        const targetTaskIndex = tasks.findIndex(t => t.id === targetTask.id);

        if (!sourceTask || targetTaskIndex === -1) return;

        // Merge logic: Absorb target into source
        // 1. Update source quantity
        const newQuantity = sourceTask.quantity + targetTask.quantity;
        sourceTask.quantity = newQuantity;
        
        // 2. Remove target task
        tasks.splice(targetTaskIndex, 1);
        
        // 3. Recalculate merged task's timeline based on new quantity and work hours
        let mergedTimeline = [];
        let mergedTotalDays = 2;
        
        if (recalculateTask) {
            const sourceStart = new Date(sourceTask.start);
            const mergeResult = recalculateTask(sourceTask, sourceStart, sourceTask.lineId);
            sourceTask.end = mergeResult.end;
            sourceTask.timeline = mergeResult.timeline || [];
            sourceTask.total_days = mergeResult.total_days || 2;
            sourceTask.total_working_days = mergeResult.total_days || 2;
        } else {
            // Fallback: Sum of days if recalculateTask not available
            const addedDays = Number(targetTask.total_days) || 0;
            const currentDays = Number(sourceTask.total_days) || 0;
            sourceTask.total_days = currentDays + addedDays;
            sourceTask.total_working_days = (Number(sourceTask.total_working_days) || 0) + (Number(targetTask.total_working_days) || 0);
            const sourceStart = new Date(sourceTask.start);
            const newEnd = new Date(sourceStart);
            newEnd.setDate(newEnd.getDate() + sourceTask.total_days);
            sourceTask.end = newEnd.toISOString();
        }
        
        tasks = [...tasks]; // Trigger reactivity

        // Track merge for backend
        pendingMerges.push({
            sourceId: targetTask.id,
            targetId: sourceTask.id
        });
        pendingMerges = [...pendingMerges]; // Trigger reactivity
        
        // Also track target B as updated (since its quantity/end date changed)
        pendingUpdates.add(sourceTask.id);

        // Log the updated MOCK_TASKS (tasks array)
        console.log('MOCK_TASKS after merge:', JSON.parse(JSON.stringify(tasks)));

        // Close modal
        showMergeModal = false;
        selectedTaskForMerge = null;
        mergeCandidates = [];
    }

    function handleMergeModalCancel() {
        showMergeModal = false;
        selectedTaskForMerge = null;
        mergeCandidates = [];
    }

    function handleDrop(e) {
        e.preventDefault();

        let durationMs = 0;
        let taskOffsetLeft = 0;
        let droppedTaskId = null;

        try {
             const rawData = e.dataTransfer.getData('text/plain');
             if (rawData) {
                const data = JSON.parse(rawData);
                droppedTaskId = data.id;
                durationMs = data.durationMs;
                taskOffsetLeft = data.taskOffsetLeft;
             }
        } catch (err) {}

        if (!droppedTaskId && draggedUnplannedTask) {
             droppedTaskId = draggedUnplannedTask.id;
             durationMs = (draggedUnplannedTask.total_days || 1) * 24 * 60 * 60 * 1000;
        }

        // If this is an unplanned task without start/end, reject and keep it unplanned.
        if (draggedUnplannedTask && (!draggedUnplannedTask.start || !draggedUnplannedTask.end)) {
            alert(`Cannot move task ${draggedUnplannedTask.orderId || draggedUnplannedTask.id} to board. Please provide start and end dates from backend before scheduling.`);
            handleDragEnd();
            return;
        }

        // Use pixel-based calculation (same as processDragOver) so the drop position
        // always matches the ghost's left edge — not the mouse position.
        // Always recalculate fresh at drop time: cachedGridRect may be null (sidebar drags)
        // or stale (user scrolled after drag started). scrollLeft must reflect current position.
        const calendarBody = document.getElementById('calendar-body');
        const calendarGrid = document.getElementById('calendar-grid');
        const scrollLeft = calendarBody ? calendarBody.scrollLeft : 0;
        // Use the scroll container (calendar-body) as reference, then add scrollLeft
        // to convert viewport-relative mouse position into grid-absolute pixel position.
        // Using the GRID rect directly would double-count scroll (grid shifts left as you scroll).
        const bodyRect = calendarBody ? calendarBody.getBoundingClientRect() : { left: 0, top: 0 };

        const mouseX = (e.clientX - bodyRect.left) + scrollLeft;
        const mouseY = e.clientY - bodyRect.top;

        // Determine line from Y
        const lineIndex = Math.floor(mouseY / ROW_HEIGHT);
        if (lineIndex < 0 || lineIndex >= lines.length) { handleDragEnd(); return; }
        const newLineId = lines[lineIndex].id;

        // Determine day from task left-edge pixel (not mouse pixel)
        const taskLeftPixel = mouseX - taskOffsetLeft;
        const dayIndexFloat = taskLeftPixel / dayColumnWidth;
        const dayIndex = Math.max(0, Math.floor(dayIndexFloat));
        const dayFraction = dayIndex === 0 && dayIndexFloat < 0 ? 0 : (dayIndexFloat - Math.floor(dayIndexFloat));

        if (dayIndex >= calendarDays.length) {
            console.warn("Drop position out of calendar bounds");
            handleDragEnd();
            return;
        }

        const day = calendarDays[dayIndex];

        // Validate against the task's left-edge day (consistent with ghost validation)
        if (day.isBlocked) {
            console.warn("Cannot drop on a blocked day!");
            handleDragEnd();
            return;
        }

        const workHours = getLineWorkHours(day.date, newLineId, day.isBlocked);
        if (workHours === 0) {
            console.warn("Cannot drop on non-working day.");
            handleDragEnd();
            return;
        }

        const baseDate = new Date(day.date);

        // Calculate time within the day based on the fraction
        const minutesIntoDay = dayFraction * 24 * 60; // Total minutes into the day
        const newStartDate = new Date(baseDate.getTime() + minutesIntoDay * 60 * 1000);

        // Recalculate timeline using production system logic if function is available
        let newEndDate;
        let recalculatedData = null;
        
        if (recalculateTask && droppedTaskId) {
            const task = tasks.find(t => t.id === droppedTaskId) || draggedUnplannedTask;
            if (task) {
                recalculatedData = recalculateTask(task, newStartDate, newLineId);
                newEndDate = new Date(recalculatedData.end);

                console.log('[Drop Timeline] task:', droppedTaskId);
                console.log('[Drop Timeline] start:', recalculatedData.start ?? newStartDate.toISOString());
                console.log('[Drop Timeline] end:', recalculatedData.end);
                console.log('[Drop Timeline] total_days:', recalculatedData.total_days);
                console.log('[Drop Timeline] timeline:', recalculatedData.timeline);

            } else {
                // Fallback to simple calculation
                newEndDate = new Date(newStartDate.getTime() + durationMs);
            }
        } else {
            // Fallback to simple calculation
            newEndDate = new Date(newStartDate.getTime() + durationMs);
        }

        if (isOverlapping(droppedTaskId, newLineId, newStartDate, newEndDate)) {
            console.warn("Cannot drop: Task overlaps with an existing task.");
            handleDragEnd();
            return;
        }

        if (newLineId && droppedTaskId) {
            const taskIndex = tasks.findIndex(t => t.id === droppedTaskId);
            if (taskIndex !== -1) {
                // Mutate existing task with recalculated data.
                // Use newStartDate (not recalculatedData.start) so the task's left edge
                // lands exactly at the ghost's left edge pixel.
                tasks[taskIndex].lineId = newLineId;
                tasks[taskIndex].start = newStartDate.toISOString();
                // Only apply recalculated data if the timeline is valid (non-empty, non-zero days)
                if (recalculatedData && recalculatedData.total_days > 0) {
                    tasks[taskIndex].end = recalculatedData.end;
                    tasks[taskIndex].timeline = recalculatedData.timeline;
                    tasks[taskIndex].total_days = recalculatedData.total_days;
                    tasks[taskIndex].total_working_days = recalculatedData.total_days;
                } else {
                    // Recalculation produced no valid timeline — preserve original duration
                    tasks[taskIndex].end = newEndDate.toISOString();
                }
                pendingUpdates.add(droppedTaskId);
            } else if (draggedUnplannedTask && droppedTaskId === draggedUnplannedTask.id) {
                // New Task — same: use newStartDate for pixel-accurate placement.
                const newTask = {
                    ...draggedUnplannedTask,
                    lineId: newLineId,
                    start: newStartDate.toISOString(),
                };
                if (recalculatedData && recalculatedData.total_days > 0) {
                    newTask.end = recalculatedData.end;
                    newTask.timeline = recalculatedData.timeline;
                    newTask.total_days = recalculatedData.total_days;
                    newTask.total_working_days = recalculatedData.total_days;
                } else {
                    newTask.end = newEndDate.toISOString();
                }
                tasks.push(newTask);
                onUnplannedDrop(droppedTaskId);
                pendingUpdates.add(droppedTaskId);
            }
        }

        // Cleanup
        if (ghostTaskElement) {
            ghostTaskElement.remove();
            ghostTaskElement = null;
        }

    }

    function renderBoard() {
        const calendarDates = document.getElementById('calendar-dates');
        const calendarGrid = document.getElementById('calendar-grid');

        if (!calendarDates || !calendarGrid) {
            console.warn("DOM elements missing for renderBoard");
            return;
        }

        // 1. Clear CALENDAR HEADER
        calendarDates.innerHTML = '';

        // 2. Clear GRID BACKGROUND ONLY
        const gridBackgroundLayer = document.getElementById('grid-background-layer');
        if (gridBackgroundLayer) {
            gridBackgroundLayer.innerHTML = '';
        }
        
        // RE-POPULATE calendarDays (centered on today with daysBefore and daysAfter)
        const tempDays = [];
        const totalDays = daysBefore + daysAfter + 1; // +1 for today itself
        
        // Start from daysBefore days before today
        const startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0); // Normalize to midnight to ensure correct day alignment
        startDate.setDate(startDate.getDate() - daysBefore);
        
        for (let i = 0; i < totalDays; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dayOfWeek = date.getDay();

            // Determine off-day from work hour API data (not day-of-week)
            // A day is off when ALL line records for that date have WorkHour === 0
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            const dateKeyDDMMYYYY = `${dd}-${mm}-${yyyy}`;
            
            let isOffDay = false;
            if (workHourMap.size > 0 && lines.length > 0) {
                let allZero = true;
                let hasAnyData = false;
                for (const line of lines) {
                    const hd = workHourMap.get(`${line.id}_${dateKeyDDMMYYYY}`);
                    if (hd) {
                        hasAnyData = true;
                        if (hd.WorkHour > 0) {
                            allZero = false;
                            break;
                        }
                    } else {
                        // Default is 10h if no data, so not all zero building
                        allZero = false;
                        break;
                    }
                }
                isOffDay = hasAnyData && allZero;
            }

            const isFriSat = dayOfWeek === 5 || dayOfWeek === 6; // Fri=5, Sat=6 always off
            const isHoliday = holidays.includes(formatDate(date, 'YYYY-MM-DD'));
            const isBlocked = isOffDay || isHoliday || isFriSat;

            // Check if this date is today
            const todayDateStr = formatDate(today, 'YYYY-MM-DD');
            const thisDateStr = formatDate(date, 'YYYY-MM-DD');
            const isToday = todayDateStr === thisDateStr;

            tempDays.push({
                date,
                dayOfWeek,
                isBlocked,
                isHoliday,
                isFriSat,
                isToday
            });
        }
        calendarDays = tempDays;

        // Set initial visible month (first day of calendar)
        if (calendarDays.length > 0) {
            currentVisibleMonth = formatDate(calendarDays[0].date, 'MMM YYYY');
        }

        // Render Dates
        calendarDays.forEach((day) => {
            const dateEl = document.createElement('div');
            // Adjusted styles for half height: h-12 is approx 48px. 
            // Removed MMM YYYY from date cell since it's above now.
            dateEl.className = `flex-shrink-0 text-center border-r border-gray-200 flex flex-col justify-center items-center ${day.isBlocked ? 'bg-gray-100 text-gray-500' : 'bg-white'} ${day.isToday ? 'bg-blue-50' : ''}`;
            dateEl.style.width = `${dayColumnWidth}px`;
            dateEl.style.height = '100%'; // Full height of the row container (h-12)

            dateEl.innerHTML = `
                <div class="flex flex-col items-center justify-center leading-tight">
                    <span class="text-[10px] font-bold uppercase tracking-wider ${day.isToday ? 'text-blue-600' : 'text-gray-400'}">
                        ${formatDate(day.date, 'ddd')}
                    </span>
                    <span class="text-lg font-black ${day.isToday ? 'text-blue-900' : 'text-gray-900'}">
                        ${day.date.getDate()}
                    </span>
                    ${day.isBlocked ? `<div class="text-[8px] uppercase font-bold text-red-500/70 mt-0.5">${day.isHoliday ? 'HOLIDAY' : 'HOLIDAY'}</div>` : ''}
                </div>
            `;
            calendarDates.appendChild(dateEl);
        });

        // Render Work Hours Summary Row
        const workHoursRow = document.getElementById('calendar-work-hours');
        if (workHoursRow) {
            workHoursRow.innerHTML = '';
            const whFrag = document.createDocumentFragment();
            calendarDays.forEach((day) => {
                const totalHrs = day.isBlocked
                    ? 0
                    : lines.reduce((sum, line) => sum + getLineWorkHours(day.date, line.id, day.isBlocked), 0);

                const cell = document.createElement('div');
                cell.className = `flex-shrink-0 border-r border-gray-200 flex items-center justify-center ${day.isBlocked ? 'bg-gray-50' : 'bg-indigo-50'}`;
                cell.style.width = `${dayColumnWidth}px`;
                cell.style.height = '100%';

                if (totalHrs > 0) {
                    cell.innerHTML = `<span class="text-[10px] font-semibold text-indigo-600">${totalHrs}h</span>`;
                } else {
                    cell.innerHTML = `<span class="text-[10px] text-gray-300">—</span>`;
                }
                whFrag.appendChild(cell);
            });
            workHoursRow.appendChild(whFrag);
        }

        // Render Grid Background Cells
        if (gridBackgroundLayer) {
            let gridCellsFrag = document.createDocumentFragment();
            
            calendarDays.forEach((day, dayIndex) => {
                lines.forEach((line, lineIndex) => {
                    const cellId = `cell-${line.id}-${formatDate(day.date, 'YYYY-MM-DD')}`;
                    const cell = document.createElement('div');
                    cell.id = cellId;


                    
                    const workHours = getLineWorkHours(day.date, line.id, day.isBlocked);
                    // Determine colors
                    let bgClass = day.isBlocked ? 'bg-gray-100' : 'bg-white';
                    
                    // Grid Lines
                    let gridLinesFaint = 'none';
                    let gridLinesStrong = 'none';
                    if (!day.isBlocked && workHours > 0) {
                        const percentPerHr = 100 / workHours;
                        gridLinesFaint = `repeating-linear-gradient(to right, #f0f0f0 0, #f0f0f0 1px, transparent 1px, transparent ${percentPerHr}%)`;
                        gridLinesStrong = `repeating-linear-gradient(to right, #a5b4fc 0, #a5b4fc 1px, transparent 1px, transparent ${percentPerHr}%)`;
                    } else if (workHours === 0) {
                         // Distinct look for 0 hours
                         bgClass = 'bg-gray-100'; 
                         gridLinesFaint = `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(156, 163, 175, 0.2) 10px, rgba(156, 163, 175, 0.2) 20px)`;
                    } else {
                         bgClass = 'bg-gray-100'; 
                    }

                    cell.className = `grid-cell absolute border-r border-b border-gray-200 ${bgClass} flex flex-col`;
                    cell.style.left = `${dayIndex * dayColumnWidth}px`;
                    cell.style.top = `${lineIndex * ROW_HEIGHT}px`;
                    cell.style.width = `${dayColumnWidth}px`;
                    cell.style.height = `${ROW_HEIGHT}px`;
                    cell.className = `grid-cell absolute border-r border-b border-gray-200 ${bgClass} flex flex-col`;
                    cell.style.left = `${dayIndex * dayColumnWidth}px`;
                    cell.style.top = `${lineIndex * ROW_HEIGHT}px`;
                    cell.style.width = `${dayColumnWidth}px`;
                    cell.style.height = `${ROW_HEIGHT}px`;
                    cell.dataset.lineId = line.id;
                    cell.dataset.date = formatDate(day.date, 'YYYY-MM-DD');
                    cell.dataset.isBlocked = day.isBlocked;
                    
                    // Task Area (Top 70%) - Grid Lines Restored
                    const taskArea = document.createElement('div');
                    taskArea.className = "flex-1 relative pointer-events-none"; // 70% height via flex-1
                    taskArea.style.height = '70%';
                    // Explicitly set background image here without 'grid-cell' class to avoid app.css background-size override if problematic
                    taskArea.style.backgroundImage = gridLinesFaint;
                    taskArea.style.backgroundSize = 'auto 100%';
                    cell.appendChild(taskArea);

                    // Hours Area (Bottom 30%)
                    const hoursArea = document.createElement('div');
                    hoursArea.className = "h-[30%] border-t border-gray-100 bg-gray-50 flex items-center justify-center pointer-events-none";
                    
                    if (!day.isBlocked && workHours > 0) {
                        const label = document.createElement('span');
                        label.className = "text-[9px] font-bold text-gray-500 uppercase tracking-tighter opacity-70";
                        label.innerText = `${workHours} h`;
                        hoursArea.appendChild(label);
                    } else if (day.isBlocked || workHours === 0) {
                        const label = document.createElement('span');
                        label.className = "text-[10px] font-bold text-red-500/70 uppercase tracking-tighter font-extrabold";
                        label.innerText = `HOLIDAY`;
                        hoursArea.appendChild(label);
                    }
                    cell.appendChild(hoursArea);

                    gridCellsFrag.appendChild(cell);
                });
            });
            gridBackgroundLayer.appendChild(gridCellsFrag);
        }

        addDragDropListeners(); 
    }

    function addDragDropListeners() {
            // Event delegation: single listener on grid parent instead of per-cell (avoids 1000+ listeners)
            if (gridListenersAttached) return;
            const grid = document.getElementById('calendar-grid');
            if (!grid) return;
            grid.addEventListener('dragover', handleDragOver);
            grid.addEventListener('dragleave', handleDragLeave);
            grid.addEventListener('drop', handleDrop);
            gridListenersAttached = true;
    }

    // Effect to re-render when dependencies change
    $effect(() => {
        if (today && lines.length > 0) {
            // Use tick or timeout to wait for DOM - but $effect runs after DOM updates usually.
            // Wait, we generate DOM manually in renderBoard, so we just need the container to exist.
            tick().then(() => {
                 renderBoard();
            });
        }
    });

    $effect(() => {
        if (workHoursData && workHoursData.length > 0) {
            workHourDataList = JSON.parse(JSON.stringify(workHoursData));
            workHourDataList.forEach(d => {
                const key = `${d.Line}_${d.Date}`;
                const existing = workHourMap.get(key);
                if (existing) {
                    existing.WorkHour = (parseFloat(existing.WorkHour) || 0) + (parseFloat(d.WorkHour) || 0);
                    if (d.Shift && !existing.Shifts?.includes(d.Shift)) {
                        existing.Shifts = [...(existing.Shifts || [existing.Shift]), d.Shift];
                    }
                } else {
                    workHourMap.set(key, { ...d, Shifts: d.Shift ? [d.Shift] : [] });
                }
            });
            tick().then(() => {
                 renderBoard();
            });
        }
    });

    onMount(() => {
        renderBoard();
    });

</script>

<div id="main-content" class="flex-1 flex flex-col h-full overflow-hidden">
    <!-- Calendar Static Toolbar (Top Row) -->
    <div id="calendar-toolbar" class="flex-shrink-0 h-12 border-b border-gray-200 bg-white flex items-center justify-between px-4 z-20 relative">
        <!-- Left: Load Earlier/Later Buttons -->
        <div class="flex items-center gap-2">
            <button 
                onclick={loadEarlierDays}
                class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200 transition-colors"
            >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Earlier
            </button>
            <span class="text-xs text-gray-400">+30 days</span>
            <button 
                onclick={loadLaterDays}
                class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200 transition-colors"
            >
                Later
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </button>

            <!-- Divider -->
            <span class="w-px h-5 bg-gray-200 mx-1"></span>

            <!-- Zoom Out -->
            <button
                onclick={zoomOut}
                disabled={dayColumnWidth <= ZOOM_MIN}
                title="Zoom Out (max 2 months visible)"
                class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-full border border-purple-200 transition-colors"
            >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path>
                </svg>
                Zoom Out
            </button>

            <!-- Zoom In -->
            <button
                onclick={zoomIn}
                disabled={dayColumnWidth >= ZOOM_MAX}
                title="Zoom In (min 4 days visible)"
                class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-full border border-purple-200 transition-colors"
            >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path>
                </svg>
                Zoom In
            </button>
        </div>
        
        <!-- Center: Date Range Display -->
        {#if calendarDays.length > 0}
            {@const startDate = calendarDays[0].date}
            {@const endDate = calendarDays[calendarDays.length - 1].date}
            {@const startDay = startDate.getDate()}
            {@const startMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][startDate.getMonth()]}
            {@const startYear = startDate.getFullYear()}
            {@const endDay = endDate.getDate()}
            {@const endMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][endDate.getMonth()]}
            {@const endYear = endDate.getFullYear()}
            <div class="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-1.5 rounded-full border border-indigo-200">
                <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <span class="text-xs font-semibold text-gray-700">
                    {startDay} {startMonth} {startYear} <span class="text-gray-400 mx-1">to</span> {endDay} {endMonth} {endYear}
                </span>
            </div>
        {/if}

        <div class="flex items-center gap-3">
            {#if selectedTaskIdsForGap.size > 0}
                <div class="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs">
                    <span class="font-medium text-amber-800">
                        Selected: {selectedTaskIdsForGap.size}/2 strips
                    </span>
                    <button onclick={clearGapSelection} class="text-amber-500 hover:text-amber-700 ml-1 font-bold">✕</button>
                    <button
                        onclick={fillGapBetweenStrips}
                        disabled={!canFillGap}
                        class="ml-2 px-2.5 py-0.5 font-semibold text-[11px] uppercase tracking-wider rounded-md text-white transition-all
                               {canFillGap ? 'bg-amber-600 hover:bg-amber-700 shadow-sm' : 'bg-gray-300 cursor-not-allowed opacity-60'}"
                    >
                        ⚡ Fill Gap
                    </button>
                </div>
            {/if}

            <div class="relative group">
                <input 
                    type="text" 
                    placeholder="Search..." 
                    class="text-xs pl-8 pr-3 py-1.5 border border-gray-200 bg-gray-50 rounded-full w-32 focus:w-48 transition-all focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 shadow-sm"
                >
                <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 transform -translate-y-1/2 group-focus-within:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
            </div>
        </div>
    </div>

    <!-- Fixed Month Indicator -->
    <div id="fixed-month-indicator" class="flex-shrink-0 h-10 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md z-30 relative">
        <span class="font-bold text-lg tracking-wide">{currentVisibleMonth || 'Loading...'}</span>
    </div>
    
    <!-- Calendar Header (Dates + Work Hours) -->
    <div id="calendar-header" class="sticky-header flex-shrink-0 bg-white shadow z-10 overflow-hidden" style="height: 76px;">
        <div class="flex flex-col w-max">
            <!-- Dates Row -->
            <div id="calendar-dates" class="flex" style="height: 48px;">
                <!-- JS Injected -->
            </div>
            <!-- Total Work Hours Row -->
            <div id="calendar-work-hours" class="flex border-t border-indigo-100" style="height: 28px;">
                <!-- JS Injected -->
            </div>
        </div>
    </div>

    <!-- Calendar Body (Planning Grid) -->
    <div 
        id="calendar-body" 
        class="flex-1 overflow-auto custom-scrollbar"
        onscroll={(e) => {
            onScroll(e.target.scrollTop);
            // Sync header scroll X
            const header = document.getElementById('calendar-header');
            if(header) header.scrollLeft = e.target.scrollLeft;
            
            // Update current visible month based on scroll position
            const scrollLeft = e.target.scrollLeft;
            const visibleDayIndex = Math.floor(scrollLeft / dayColumnWidth);
            if (calendarDays[visibleDayIndex]) {
                currentVisibleMonth = formatDate(calendarDays[visibleDayIndex].date, 'MMM YYYY');
            }
        }}
    >
        <div id="calendar-grid" class="relative min-w-max" style="height: {lines.length * ROW_HEIGHT}px;">
            <!-- 1. Grid Background Layer (Managed by Vanilla JS) -->
            <div id="grid-background-layer" class="absolute inset-0 z-0">
                <!-- Grid cells injected here -->
            </div>

            <!-- 2. Tasks Layer (Managed by Svelte) -->
            <div id="tasks-layer" class="absolute inset-0 z-10 pointer-events-none" class:drag-active={isDragging}>
                {#each tasks as task (task.id)}
                    {@const isCandidate = showMergeModal && mergeCandidates.some(t => t.id === task.id)}
                    {@const isSource = showMergeModal && selectedTaskForMerge && selectedTaskForMerge.id === task.id}
                    {@const isDimmed = showMergeModal && !isCandidate && !isSource}
                    {@const isGapSelected = selectedTaskIdsForGap.has(task.id)}
                    {@const runsToday = isTaskActiveToday(task)}
                    {@const todayGeom = todayColumnGeometry()}
                    
                    {#if getTaskStyle(task)}
                        {@const taskStyle = getTaskStyle(task)}
                        {@const holidaySegs = getHolidaySegments(task)}
                        
                        {#if isGapSelected}
                            <div 
                                class="absolute z-20 pointer-events-none rounded transition-all animate-pulse" 
                                style="{taskStyle} outline: 3px solid #d97706; outline-offset: 1px; background-color: rgba(217, 119, 6, 0.1);"
                            ></div>
                        {/if}

                        {#if runsToday && todayGeom}
                            <div 
                                class="absolute z-20 pointer-events-none border-2 border-amber-500 bg-gray-900/40 backdrop-blur-[0.5px] shadow-[0_0_12px_rgba(245,158,11,0.6)] flex items-center justify-center overflow-hidden"
                                style="
                                    left: {todayGeom.leftPixel}px;
                                    width: {todayGeom.widthPixel}px;
                                    top: {getTaskStyle(task).match(/top:\s*([^;]+)/)?.[1] || '0px'};
                                    height: {getTaskStyle(task).match(/height:\s*([^;]+)/)?.[1] || '100px'};
                                    border-radius: 4px;
                                "
                            >
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 animate-pulse"></div>
                                
                                <span class="text-[9px] font-black tracking-wider text-white bg-amber-600 border border-amber-400 px-1.5 py-0.5 rounded shadow-md select-none transform scale-100">
                                    Running
                                </span>
                            </div>
                        {/if}

                        <Task 
                            {task}
                            style={taskStyle}
                            isMergeCandidate={isCandidate}
                            isDimmed={isDimmed}
                            isBoardDragging={isDragging}
                            onDragStart={(e) => handleDragStart(e, task)}
                            onDragEnd={(e) => handleDragEnd(e)}
                            onClick={(e, t) => {
                                if (isCandidate) handleMergeTask(t);
                                if (selectedTaskIdsForGap.size > 0) toggleTaskSelectionForGap(t.id);
                            }}
                            onContextMenu={(e, task) => handleTaskContextMenu(e, task)}
                            {formatDate}
                        />
                        
                        {#each holidaySegs as seg}
                            <div
                                class="absolute pointer-events-none"
                                style="
                                    left: {seg.taskLeftPixel + seg.left}px;
                                    top: {seg.top}px;
                                    width: {seg.width}px;
                                    height: {seg.height}px;
                                    z-index: 12;
                                    background: repeating-linear-gradient(
                                        45deg,
                                        rgba(220,38,38,0.45) 0px,
                                        rgba(220,38,38,0.45) 4px,
                                        rgba(255,255,255,0.15) 4px,
                                        rgba(255,255,255,0.15) 10px
                                    );
                                    border-left: 2px solid rgba(220,38,38,0.8);
                                    border-right: 2px solid rgba(220,38,38,0.8);
                                    border-radius: 0;
                                    box-sizing: border-box;
                                "
                            ></div>
                        {/each}
                    {/if}
                {/each}
            </div>
        </div>
    </div>

    <!-- Context Menu -->
    <ContextMenu 
            bind:visible={showContextMenu}
            x={contextMenuX}
            y={contextMenuY}
            menuItems={[
                { id: 'toggle-gap-select', label: selectedTaskForContext && selectedTaskIdsForGap.has(selectedTaskForContext.id) ? 'Deselect to Fill Gap' : 'Select to Fill Gap ⚡', icon: '📍' },
                { id: 'split', label: 'Split Task', icon: '✂️' },
                { id: 'merge', label: 'Merge Task', icon: '🔗' },
                { id: 'strip-details', label: 'Strip Details', icon: '📋' },
                { id: 'update-datetime', label: selectedTaskForContext?.start ? 'Update Date & Time' : 'Select Date & Time', icon: '📅' }
            ]}
            onItemClick={(item) => {
                if (item.id === 'toggle-gap-select' && selectedTaskForContext) {
                    toggleTaskSelectionForGap(selectedTaskForContext.id);
                    showContextMenu = false;
                } else {
                    handleContextMenuItemClick(item);
                }
            }}
            onClose={handleContextMenuClose}
    />

    <!-- Split Task Modal -->
    <SplitTaskModal 
        bind:visible={showSplitModal}
        task={selectedTaskForSplit}
        onSubmit={handleSplitTask}
        onCancel={handleSplitModalCancel}
    />

    <!-- Merge Task Modal -->
    <MergeTaskModal 
        bind:visible={showMergeModal}
        sourceTask={selectedTaskForMerge}
        candidates={mergeCandidates}
        onMerge={handleMergeTask}
        onCancel={handleMergeModalCancel}
    />

    <!-- Strip Details Modal -->
    <StripDetailsModal
        bind:visible={showStripDetailsModal}
        task={selectedTaskForDetails}
        onClose={() => { showStripDetailsModal = false; selectedTaskForDetails = null; }}
    />

    <!-- Update Date & Time Modal -->
    {#if showDateTimeModal && selectedTaskForDateTime}
        <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-10000 backdrop-blur-sm">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                <div class="px-6 pt-6 pb-4">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-base font-semibold text-gray-900">
                                {selectedTaskForDateTime.start ? 'Update Date & Time' : 'Select Date & Time'}
                            </h2>
                            <p class="text-xs text-gray-500 mt-0.5">{selectedTaskForDateTime.orderId} · {selectedTaskForDateTime.style}</p>
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                            <input
                                type="date"
                                bind:value={dateTimeModalValue}
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div class="w-32">
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
                            <input
                                type="time"
                                bind:value={dateTimeTimeValue}
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <p class="text-xs text-gray-400 mt-2">The end date will be recalculated based on quantity and line efficiency.</p>
                </div>
                <div class="px-6 pb-6 flex gap-3">
                    <button
                        onclick={() => { showDateTimeModal = false; selectedTaskForDateTime = null; }}
                        class="flex-1 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 py-2.5 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onclick={applyDateTimeChange}
                        disabled={!dateTimeModalValue}
                        class="flex-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    /* During drag, disable pointer-events on all tasks so drag/drop events reach grid cells */
    :global(#tasks-layer.drag-active .task) {
        pointer-events: none !important;
    }

    :global(.task-highlight-flash) {
        animation: highlightPulse 1.8s ease-out forwards;
    }
    @keyframes highlightPulse {
        0%   { outline: 3px solid #fbbf24; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(251,191,36,0.5); }
        60%  { outline: 3px solid #fbbf24; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(251,191,36,0.5); }
        100% { outline: 3px solid transparent; box-shadow: none; }
    }
</style>
