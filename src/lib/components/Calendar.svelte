<script>
    import { onMount, tick } from 'svelte';
    import Task from '$lib/components/Task.svelte';
    import ContextMenu from '$lib/components/ContextMenu.svelte';
    import SplitTaskModal from '$lib/components/SplitTaskModal.svelte';
    import MergeTaskModal from '$lib/components/MergeTaskModal.svelte';
	import { work_hour_data } from '$lib/stores/data';
	import { getWorkHourData } from '$lib/api-call';

    // Props
    let { 
        tasks = $bindable([]),
        lines = [],
        today = new Date(),
        holidays = [],
        draggedUnplannedTask = null,
        workHoursData = [],
        recalculateTask = null,
        onUnplannedDrop = () => {},
        onScroll = () => {}
    } = $props();

    // Internal State
    let calendarDays = $state([]);
    let workHourDataList = []; // Plain array, no reactivity needed
    let currentVisibleMonth = $state(''); // Track current visible month based on scroll
    
    // Constants - Calendar starts on today and shows 60 days forward
    let daysBefore = $state(0);  // Start on today (no days before)
    let daysAfter = $state(60);   // Show 60 days after today
    const DAY_COLUMN_WIDTH = 140; // Wider columns for better visibility
    const ROW_HEIGHT = 36;
    const FOOTER_HEIGHT = 0; // Removed footer for compactness
    const START_HOUR = 8;
    const END_HOUR = 18;

    // Functions to load more days
    function loadEarlierDays() {
        daysBefore += 30;
        renderBoard();
    }

    function loadLaterDays() {
        daysAfter += 30;
        renderBoard();
    }

    // Reset to today view (today + 30 days) - called when TODAY is clicked
    export function resetToToday() {
        daysBefore = 0;
        daysAfter = 30;
        renderBoard();
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
    

    function getLineWorkHours(date, lineId) {
        // 1. Check if it's a blocked day (weekend/holiday)
        const dateStr = formatDate(date, 'YYYY-MM-DD');
        const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
        
        if (day && day.isBlocked) return 0;

        // Use fetched work hour data (already deeply cloned to strip proxies)
        const dataSource = workHourDataList.length > 0 ? workHourDataList : [];
        
        const filtr_for_line = dataSource.filter(d => d.Line === lineId);
        
        // Convert date format from YYYY-MM-DD to DD-MM-YYYY for API data
        let date_ = `${dateStr.split('-')[2]}-${dateStr.split('-')[1]}-${dateStr.split('-')[0]}`;
        
        const workHourData = filtr_for_line.find(d => d.Date === date_)
        
        if (workHourData) {
            return workHourData?.WorkHour || 0;
        }
        else {
            return getStandardWorkHours(date.getDay());
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
        
        return diffDays * DAY_COLUMN_WIDTH;
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
            endPixel = (lastDayIndex * DAY_COLUMN_WIDTH) + DAY_COLUMN_WIDTH;
        }

        const width = endPixel - startPixel;
        if (width <= 0) return '';

        // NEW: Split row layout (Tasks in top 70%)
        const TASK_HEIGHT_PERCENT = 0.7;
        const top = (lineIndex * ROW_HEIGHT) + 2; // small 2px padding
        const height = (ROW_HEIGHT * TASK_HEIGHT_PERCENT) - 4; // padding adjustment
        
        return `left: ${startPixel}px; top: ${top}px; width: ${width}px; height: ${height}px;`;
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

        // Create a custom drag image that shows the task at the correct offset
        const dragImage = e.target.cloneNode(true);
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-9999px';
        dragImage.style.opacity = '1';
        document.body.appendChild(dragImage);

        // Set drag image offset so the cursor is at the grab point
        // This makes the left edge appear at mouseX - taskOffsetLeft
        const dragImageOffsetY = e.clientY - taskRect.top;
        e.dataTransfer.setDragImage(dragImage, taskOffsetLeft, dragImageOffsetY);

        // Clean up the temporary drag image after a short delay
        setTimeout(() => {
            document.body.removeChild(dragImage);
        }, 0);

        // Disable pointer-events on all tasks during drag so events reach grid cells.
        // Controlled reactively via isDragging passed to Task components.
        // We use setTimeout to ensure the browser has fully initialized the drag operation
        // before we modify the element's pointer-events.
        setTimeout(() => {
            isDragging = true;
            console.log('--- Drag Start Initiated ---');
            console.log('Dragged Task ID:', draggedTaskId);
        }, 0);

        if (ghostTaskElement) ghostTaskElement.remove();
        if (dragOutlineElement) dragOutlineElement.remove();

        ghostTaskElement = document.createElement('div');
        ghostTaskElement.id = 'ghost-task';
        ghostTaskElement.style.pointerEvents = 'none';
        
        // Use the found element (root)
        const sourceEl = e.target.closest('.task') || e.target;
        
        ghostTaskElement.style.top = sourceEl.style.top;
        ghostTaskElement.style.left = sourceEl.style.left;
        ghostTaskElement.style.width = sourceEl.style.width;
        const height = ROW_HEIGHT - FOOTER_HEIGHT - 10;
        ghostTaskElement.style.height = `${height}px`;
        ghostTaskElement.classList.add('valid');

        // Create outline overlay (positioned element, moves with ghost — no class toggling)
        dragOutlineElement = document.createElement('div');
        dragOutlineElement.id = 'drag-outline';
        dragOutlineElement.style.position = 'absolute';
        dragOutlineElement.style.zIndex = '5';
        dragOutlineElement.style.pointerEvents = 'none';
        dragOutlineElement.style.width = `${DAY_COLUMN_WIDTH}px`;
        dragOutlineElement.style.height = `${ROW_HEIGHT}px`;
        dragOutlineElement.style.outline = '2px dashed #0ea5e9';
        dragOutlineElement.style.backgroundColor = 'rgba(224, 242, 254, 0.5)';
        dragOutlineElement.style.boxSizing = 'border-box';
        // Initial position matching task
        const initDayIndex = Math.floor(parseFloat(sourceEl.style.left) / DAY_COLUMN_WIDTH);
        const lineIndex = lines.findIndex(l => l.id === task.lineId);
        dragOutlineElement.style.left = `${initDayIndex * DAY_COLUMN_WIDTH}px`;
        dragOutlineElement.style.top = `${lineIndex * ROW_HEIGHT}px`;

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
        
        // Match standard task styling for unplanned ghost
        ghostTaskElement.style.position = 'absolute';
        ghostTaskElement.style.backgroundColor = 'rgba(59, 130, 246, 0.5)'; // blue-500 with opacity
        ghostTaskElement.style.border = '1px dashed #2563eb'; // blue-600
        ghostTaskElement.style.borderRadius = '0.375rem'; // rounded-md
        
        ghostTaskElement.style.width = width;
        ghostTaskElement.style.top = top;
        ghostTaskElement.style.left = left;
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
        const targetCell = e.target.closest('.grid-cell');

        // --- UNPLANNED TASK GHOST CREATION ---
        if (!draggedTaskId && draggedUnplannedTask && !ghostTaskElement) {
             const estimatedWidth = (draggedUnplannedTask.total_days || 1) * DAY_COLUMN_WIDTH;
             if (!cachedGridRect) cachedGridRect = document.getElementById('calendar-grid').getBoundingClientRect();
             if (!cachedCalendarBody) cachedCalendarBody = document.getElementById('calendar-body');
             const relX = e.clientX - cachedGridRect.left;
             const relY = e.clientY - cachedGridRect.top;
             createGhostTask(`${estimatedWidth}px`, `${relY}px`, `${relX}px`);
        }

        if (!targetCell || !ghostTaskElement) return;

        // Get line info from the cell under the mouse
        const newLineId = targetCell.dataset.lineId;
        const isBlocked = targetCell.dataset.isBlocked === 'true';

        let activeTaskId = draggedTaskId;
        let durationMs = draggedTaskDurationMs;
        let taskOffsetLeft = draggedTaskOffsetLeft;

        if (!activeTaskId && draggedUnplannedTask) {
             activeTaskId = draggedUnplannedTask.id;
             if (!durationMs) {
                durationMs = (draggedUnplannedTask.total_days || 1) * 24 * 60 * 60 * 1000;
             }
        }

        // Use cached grid rect (avoids forced layout reflow on every dragover)
        if (!cachedGridRect) cachedGridRect = document.getElementById('calendar-grid').getBoundingClientRect();
        if (!cachedCalendarBody) cachedCalendarBody = document.getElementById('calendar-body');
        const mouseX = e.clientX - cachedGridRect.left + cachedCalendarBody.scrollLeft;
        const taskLeftPixel = mouseX - taskOffsetLeft;

        // Calculate which date/time this pixel position corresponds to
        const dayIndexFloat = taskLeftPixel / DAY_COLUMN_WIDTH;
        const dayIndex = Math.floor(dayIndexFloat);
        const dayFraction = dayIndexFloat - dayIndex;

        if (dayIndex < 0 || dayIndex >= calendarDays.length) {
            ghostTaskElement.classList.remove('valid');
            ghostTaskElement.classList.add('invalid');
            e.dataTransfer.dropEffect = 'none';
            if (dragOutlineElement) dragOutlineElement.style.display = 'none';
            return;
        }

        // --- FAST PATH: Position ghost + outline with pure style updates (same paint frame) ---
        const lineIndex = lines.findIndex(l => l.id === newLineId);
        const newTop = (lineIndex * ROW_HEIGHT) + 10;

        // Position ghost (pixel-precise, updates every frame)
        const durationDays = durationMs / (1000 * 60 * 60 * 24);
        const newWidth = durationDays * DAY_COLUMN_WIDTH;
        ghostTaskElement.style.left = `${taskLeftPixel}px`;
        ghostTaskElement.style.width = `${newWidth}px`;
        ghostTaskElement.style.top = `${newTop}px`;

        // Position outline overlay (snaps to cell grid, same style update as ghost — zero lag)
        if (dragOutlineElement) {
            dragOutlineElement.style.left = `${dayIndex * DAY_COLUMN_WIDTH}px`;
            dragOutlineElement.style.top = `${lineIndex * ROW_HEIGHT}px`;
            dragOutlineElement.style.display = '';
        }

        // --- VALIDATION (runs after positioning so visuals are never delayed) ---
        const leftEdgeDay = calendarDays[dayIndex];
        const baseDate = new Date(leftEdgeDay.date);
        const workHoursForDay = getLineWorkHours(baseDate, newLineId);
        const isLeftEdgeBlocked = leftEdgeDay.isBlocked || workHoursForDay === 0;

        const minutesIntoDay = dayFraction * 24 * 60;
        const newStartDate = new Date(baseDate.getTime() + minutesIntoDay * 60 * 1000);
        const newEndDate = new Date(newStartDate.getTime() + durationMs);
        const hasOverlap = isOverlapping(activeTaskId, newLineId, newStartDate, newEndDate);

        if (isLeftEdgeBlocked || hasOverlap) {
            ghostTaskElement.classList.remove('valid');
            ghostTaskElement.classList.add('invalid');
            e.dataTransfer.dropEffect = 'none';
        } else {
            ghostTaskElement.classList.remove('invalid');
            ghostTaskElement.classList.add('valid');
            e.dataTransfer.dropEffect = 'move';
        }
    }

    function handleDragEnd(e) {
        console.log('--- handleDragEnd ---');
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
             // Show ALL other tasks as candidates (as per user request "show other task from MOCK_TASKS")
             // We can visually distinguish matching/non-matching in the modal if needed, 
             // but for now we won't filter them out.
             const candidates = tasks.filter(t => t.id !== selectedTaskForContext.id);
            
            selectedTaskForMerge = selectedTaskForContext;
            mergeCandidates = candidates;
            showMergeModal = true;
        }
        showContextMenu = false;
    }

    function handleContextMenuClose() {
        showContextMenu = false;
        selectedTaskForContext = null;
    }

    function handleSplitTask({ splitQuantity }) {
        if (!selectedTaskForSplit) return;

        const originalTask = tasks.find(t => t.id === selectedTaskForSplit.id);
        if (!originalTask) return;

        // 1. Reduce original task quantity
        const oldQuantity = originalTask.quantity;
        const newOriginalQuantity = oldQuantity - splitQuantity;
        
        if (newOriginalQuantity <= 0) {
            console.error("Cannot split more than available quantity");
            return;
        }

        originalTask.quantity = newOriginalQuantity;

        // 2. Do NOT recalculate ORIGINAL task duration/end date (User requirement: "current task should be the same start and end day")
        // We only updated quantity.

        // 3. Create NEW task
        const newTaskId = `${originalTask.id}-split-${Date.now()}`;
        
        // User Request: "new task sholud be start on current task end day and end day would be 2 days after the stertting day"
        const newTaskStart = new Date(originalTask.end);
        const newTaskEnd = new Date(newTaskStart);
        newTaskEnd.setDate(newTaskEnd.getDate() + 2);

        const newTask = {
            ...originalTask,
            id: newTaskId,
            quantity: splitQuantity,
            completed_quantity: 0,
            completed_segments: [],
            start: newTaskStart.toISOString(),
            end: newTaskEnd.toISOString(),
            total_days: 2, // Approximate
            total_working_days: 2 // Approximate
        };

        // Adjust completed_quantity of original if it exceeds new quantity
        if (originalTask.completed_quantity > originalTask.quantity) {
            originalTask.completed_quantity = originalTask.quantity;
        }

        console.log('--- SPLIT TASK DEBUG ---');
        console.log('Original Task Start:', originalTask.start);
        console.log('Original Task End:', originalTask.end);
        console.log('New Task Start:', newTask.start);
        console.log('New Task End:', newTask.end);
        console.log('------------------------');

        // Add new task to tasks array
        tasks.push(newTask);
        tasks = [...tasks]; // Trigger reactivity

        console.log('MOCK_TASKS after split:', JSON.parse(JSON.stringify(tasks)));

        // Close modal and reset state
        showSplitModal = false;
        selectedTaskForSplit = null;
    }

    function handleSplitModalCancel() {
        showSplitModal = false;
        selectedTaskForSplit = null;
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
        
        // 3. User Logic: Sum of days
        const addedDays = Number(targetTask.total_days) || 0;
        const currentDays = Number(sourceTask.total_days) || 0;
        
        sourceTask.total_days = currentDays + addedDays;
        sourceTask.total_working_days = (Number(sourceTask.total_working_days) || 0) + (Number(targetTask.total_working_days) || 0);

        // Calculate new end date based on new total_days
        const sourceStart = new Date(sourceTask.start);
        const newEnd = new Date(sourceStart);
        newEnd.setDate(newEnd.getDate() + sourceTask.total_days);
        
        sourceTask.end = newEnd.toISOString();
        
        tasks = [...tasks]; // Trigger reactivity

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
        
        const targetCell = e.target.closest('.grid-cell');
        if (!targetCell) return;

        targetCell.classList.remove('drag-over');
        targetCell.classList.remove('drag-over-invalid');

        const newLineId = targetCell.dataset.lineId;
        const dateStr = targetCell.dataset.date;
        const isBlocked = targetCell.dataset.isBlocked === 'true';

        let durationMs = 0;
        let taskOffsetLeft = 0;
        let droppedTaskId = null;

        try {
             // Try standard drag data first
             const rawData = e.dataTransfer.getData('text/plain');
             if (rawData) {
                const data = JSON.parse(rawData);
                droppedTaskId = data.id;
                durationMs = data.durationMs;
                taskOffsetLeft = data.taskOffsetLeft;
             }
        } catch (err) {}

        // Fallback or override if it's an unplanned task
        if (!droppedTaskId && draggedUnplannedTask) {
             console.log('Using draggedUnplannedTask for drop:', draggedUnplannedTask);
             droppedTaskId = draggedUnplannedTask.id;
             durationMs = (draggedUnplannedTask.total_days || 1) * 24 * 60 * 60 * 1000;
        }

        console.log('handleDrop: droppedTaskId:', droppedTaskId, 'draggedUnplannedTask:', draggedUnplannedTask);

        if (isBlocked) {
            console.warn("Cannot drop on a blocked day!");
            return;
        }
        
        const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
        const workHours = getLineWorkHours(new Date(dateStr), newLineId);

        if (!day || workHours === 0) {
            console.warn("Cannot drop on non-working day.");
            return;
        }

        // Calculate task position based on mouse position minus the grab offset
        const gridRect = document.getElementById('calendar-grid').getBoundingClientRect();
        const mouseX = e.clientX - gridRect.left + document.getElementById('calendar-body').scrollLeft;
        const taskLeftPixel = mouseX - taskOffsetLeft;

        // Calculate which date/time this pixel position corresponds to
        const dayIndexFloat = taskLeftPixel / DAY_COLUMN_WIDTH;
        const dayIndex = Math.floor(dayIndexFloat);
        const dayFraction = dayIndexFloat - dayIndex;

        if (dayIndex < 0 || dayIndex >= calendarDays.length) {
            console.warn("Drop position out of calendar bounds");
            return;
        }

        const baseDate = new Date(calendarDays[dayIndex].date);

        // Calculate time within the day based on the fraction
        const minutesIntoDay = dayFraction * 24 * 60; // Total minutes into the day
        const newStartDate = new Date(baseDate.getTime() + minutesIntoDay * 60 * 1000);

        console.log('=== DROP DATE DEBUG ===');
        console.log('dateStr from cell:', dateStr);
        console.log('Mouse X:', mouseX);
        console.log('Task Offset Left:', taskOffsetLeft);
        console.log('Task Left Pixel:', taskLeftPixel);
        console.log('Day Index:', dayIndex, 'Day Fraction:', dayFraction);
        console.log('newStartDate constructed:', newStartDate.toISOString());
        console.log('newStartDate local:', newStartDate.toString());
        console.log('======================');

        // Recalculate timeline using production system logic if function is available
        let newEndDate;
        let recalculatedData = null;
        
        if (recalculateTask && droppedTaskId) {
            const task = tasks.find(t => t.id === droppedTaskId) || draggedUnplannedTask;
            if (task) {
                recalculatedData = recalculateTask(task, newStartDate, newLineId);
                newEndDate = new Date(recalculatedData.end);
                
                // Console log the strip's timeline
                console.log('=== STRIP TIMELINE ON DROP ===');
                console.log('Strip ID:', task.id);
                console.log('Line ID:', newLineId);
                console.log('Start Date:', recalculatedData.start);
                console.log('End Date:', recalculatedData.end);
                console.log('Total Days:', recalculatedData.total_days);
                console.log('Timeline:', recalculatedData.timeline);
                console.log('==============================');
            } else {
                // Fallback to simple calculation
                newEndDate = new Date(newStartDate.getTime() + durationMs);
            }
        } else {
            // Fallback to simple calculation
            newEndDate = new Date(newStartDate.getTime() + durationMs);
        }

        if (isOverlapping(droppedTaskId, newLineId, newStartDate, newEndDate)) {
            console.warn("DROP REJECTED: Task would overlap with another task.");
            return;
        }

        if (newLineId && droppedTaskId) {
            const taskIndex = tasks.findIndex(t => t.id === droppedTaskId);
            if (taskIndex !== -1) {
                // Mutate existing task with recalculated data
                tasks[taskIndex].lineId = newLineId;
                if (recalculatedData) {
                    tasks[taskIndex].start = recalculatedData.start;
                    tasks[taskIndex].end = recalculatedData.end;
                    tasks[taskIndex].timeline = recalculatedData.timeline;
                    tasks[taskIndex].total_days = recalculatedData.total_days;
                    tasks[taskIndex].total_working_days = recalculatedData.total_days;
                } else {
                    tasks[taskIndex].start = newStartDate.toISOString();
                    tasks[taskIndex].end = newEndDate.toISOString();
                }
            } else if (draggedUnplannedTask && droppedTaskId === draggedUnplannedTask.id) {
                // New Task with recalculated data
                const newTask = {
                    ...draggedUnplannedTask,
                    lineId: newLineId,
                };
                if (recalculatedData) {
                    newTask.start = recalculatedData.start;
                    newTask.end = recalculatedData.end;
                    newTask.timeline = recalculatedData.timeline;
                    newTask.total_days = recalculatedData.total_days;
                    newTask.total_working_days = recalculatedData.total_days;
                } else {
                    newTask.start = newStartDate.toISOString();
                    newTask.end = newEndDate.toISOString();
                }
                tasks.push(newTask);
                onUnplannedDrop(droppedTaskId);
            }
        }

        // Cleanup
        if (ghostTaskElement) {
            ghostTaskElement.remove();
            ghostTaskElement = null;
        }

        console.log('MOCK_TASKS after drop:', JSON.parse(JSON.stringify(tasks)));
    }

    function renderBoard() {
        console.log("Rendering board (background only)...");
        
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
            const workHours = getStandardWorkHours(dayOfWeek); 
            // NOTE: workHours here is just for "is it weekend?", line specific hours overrides this.
            // But we keep it to know if it's a weekend globally.
            const isWeekend = workHours === 0;
            const isHoliday = holidays.includes(formatDate(date, 'YYYY-MM-DD'));
            const isBlocked = isWeekend || isHoliday;
            
            // Check if this date is today
            const todayDateStr = formatDate(today, 'YYYY-MM-DD');
            const thisDateStr = formatDate(date, 'YYYY-MM-DD');
            const isToday = todayDateStr === thisDateStr;

            tempDays.push({
                date,
                dayOfWeek,
                // workHours, // REMOVE THIS from global day object to avoid confusion
                isBlocked,
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
            dateEl.style.width = `${DAY_COLUMN_WIDTH}px`;
            dateEl.style.height = '100%'; // Full height of the row container (h-12)

            dateEl.innerHTML = `
                <div class="flex flex-col items-center justify-center leading-tight">
                    <span class="text-[10px] font-bold uppercase tracking-wider ${day.isToday ? 'text-blue-600' : 'text-gray-400'}">
                        ${formatDate(day.date, 'ddd')}
                    </span>
                    <span class="text-lg font-black ${day.isToday ? 'text-blue-900' : 'text-gray-900'}">
                        ${day.date.getDate()}
                    </span>
                    ${day.isBlocked ? `<div class="text-[8px] uppercase font-bold text-red-500/70 mt-0.5">${day.isHoliday ? 'HOLIDAY' : 'WEEKEND'}</div>` : ''}
                </div>
            `;
            calendarDates.appendChild(dateEl);
        });

        // Render Grid Background Cells
        if (gridBackgroundLayer) {
            let gridCellsFrag = document.createDocumentFragment();
            
            calendarDays.forEach((day, dayIndex) => {
                lines.forEach((line, lineIndex) => {
                    const cellId = `cell-${line.id}-${formatDate(day.date, 'YYYY-MM-DD')}`;
                    const cell = document.createElement('div');
                    cell.id = cellId;


                    
                    const workHours = getLineWorkHours(day.date, line.id);
                    // Determine colors
                    let bgClass = day.isBlocked ? 'bg-gray-100' : 'bg-white';
                    
                    // Grid Lines
                    let gridLinesFaint = 'none';
                    let gridLinesStrong = 'none';
                    if (!day.isBlocked && workHours > 0) {
                        const percentPerHr = 100 / workHours;
                        gridLinesFaint = `repeating-linear-gradient(to right, #f0f0f0 0, #f0f0f0 1px, transparent 1px, transparent ${percentPerHr}%)`;
                        gridLinesStrong = `repeating-linear-gradient(to right, #a5b4fc 0, #a5b4fc 1px, transparent 1px, transparent ${percentPerHr}%)`;
                    } else {
                         // If blocked or 0 hours, maybe distinct look?
                         bgClass = 'bg-gray-100'; 
                    }

                    cell.className = `grid-cell absolute border-r border-b border-gray-200 ${bgClass} flex flex-col`;
                    cell.style.left = `${dayIndex * DAY_COLUMN_WIDTH}px`;
                    cell.style.top = `${lineIndex * ROW_HEIGHT}px`;
                    cell.style.width = `${DAY_COLUMN_WIDTH}px`;
                    cell.style.height = `${ROW_HEIGHT}px`;
                    cell.className = `grid-cell absolute border-r border-b border-gray-200 ${bgClass} flex flex-col`;
                    cell.style.left = `${dayIndex * DAY_COLUMN_WIDTH}px`;
                    cell.style.top = `${lineIndex * ROW_HEIGHT}px`;
                    cell.style.width = `${DAY_COLUMN_WIDTH}px`;
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
            // Re-attach listeners to NEW grid cells
            const cells = document.querySelectorAll('.grid-cell');
            cells.forEach(cell => {
                cell.addEventListener('dragover', handleDragOver);
                cell.addEventListener('dragleave', handleDragLeave);
                cell.addEventListener('drop', handleDrop);
            });
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

    onMount(async () => {
        // Fetch work hour data from API
        const apiWorkHourData = await getWorkHourData();
     
        
        if (apiWorkHourData && apiWorkHourData.length > 0) {
            // Deep clone to strip all Svelte 5 reactive proxies from objects
            workHourDataList = JSON.parse(JSON.stringify(apiWorkHourData));
            console.log('Work hour data loaded:', workHourDataList.length, 'records');
        }
        
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

        <!-- Right: Search Bar -->
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

    <!-- Fixed Month Indicator -->
    <div id="fixed-month-indicator" class="flex-shrink-0 h-10 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md z-30 relative">
        <span class="font-bold text-lg tracking-wide">{currentVisibleMonth || 'Loading...'}</span>
    </div>
    
    <!-- Calendar Header (Dates) -->
    <div id="calendar-header" class="sticky-header flex-shrink-0 bg-white shadow z-10 h-14 overflow-hidden">
        <div class="flex h-full w-max">
            <!-- Dates Row -->
            <div id="calendar-dates" class="flex h-14">
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
            const visibleDayIndex = Math.floor(scrollLeft / DAY_COLUMN_WIDTH);
            if (calendarDays[visibleDayIndex]) {
                currentVisibleMonth = formatDate(calendarDays[visibleDayIndex].date, 'MMM YYYY');
            }
        }}
    >
        <div id="calendar-grid" class="relative min-w-max">
            <!-- 1. Grid Background Layer (Managed by Vanilla JS) -->
            <div id="grid-background-layer" class="absolute inset-0 z-0">
                <!-- Grid cells injected here -->
            </div>

            <!-- 2. Tasks Layer (Managed by Svelte) -->
            <div id="tasks-layer" class="absolute inset-0 z-10 pointer-events-none" class:drag-active={isDragging}>
                <!-- Tasks rendered by Svelte loop -->
                {#each tasks as task (task.id)}
                    {@const isCandidate = showMergeModal && mergeCandidates.some(t => t.id === task.id)}
                    {@const isSource = showMergeModal && selectedTaskForMerge && selectedTaskForMerge.id === task.id}
                    {@const isDimmed = showMergeModal && !isCandidate && !isSource}
                    
                    {#if getTaskStyle(task)}
                        <Task 
                            {task}
                            style={getTaskStyle(task)}
                            isMergeCandidate={isCandidate}
                            isDimmed={isDimmed}
                            isBoardDragging={isDragging}
                            onDragStart={(e) => handleDragStart(e, task)}
                            onDragEnd={(e) => handleDragEnd(e)}
                            onClick={(e, t) => {
                                if (isCandidate) handleMergeTask(t);
                            }}
                            onContextMenu={(e, task) => handleTaskContextMenu(e, task)}
                            {formatDate}
                        />
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
            { id: 'split', label: 'Split Task', icon: '✂️' },
            { id: 'merge', label: 'Merge Task', icon: '🔗' }
        ]}
        onItemClick={handleContextMenuItemClick}
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
</div>

<style>
    /* During drag, disable pointer-events on all tasks so drag/drop events reach grid cells */
    :global(#tasks-layer.drag-active .task) {
        pointer-events: none !important;
    }
</style>
