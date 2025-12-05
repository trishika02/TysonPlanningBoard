
    <div id="app" class="flex h-screen w-full">
        <!-- === Left Sticky Sidebar (Line Names) === -->
        <div id="sidebar" class="sticky-sidebar flex-shrink-0 bg-white shadow-lg">
            <!-- Sidebar Header -->
            <div class="h-auto md:h-24 border-b border-gray-200 flex flex-col justify-center p-4 sticky-header bg-white">
                <h2 class="text-lg font-bold text-gray-700 text-center">Lines</h2>
                <!-- NEW: Date Navigation -->
                <div class="mt-2 space-y-2">
                    <div class="flex space-x-2">
                        <input type="date" id="date-picker" class="text-xs p-1 border rounded w-full">
                        <button id="go-to-date-btn" class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded">Go</button>
                    </div>
                    <button id="go-to-today-btn" class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 w-full px-2 py-1 rounded">Go to Today</button>
                </div>
            </div>
            <!-- Sidebar Body (Line Rows) -->
            <div id="sidebar-rows" class="divide-y divide-gray-200">
                <!-- Line names will be injected by JS -->
            </div>
        </div>

        <!-- === Main Content (Scrollable Calendar) === -->
        <div id="main-content" class="flex-1 flex flex-col">
            <!-- Calendar Header (Dates) -->
            <div id="calendar-header" class="sticky-header flex-shrink-0 bg-white shadow z-10">
                <!-- Header row for dates -->
                <div id="calendar-dates" class="flex">
                    <!-- Date columns will be injected by JS -->
                </div>
            </div>

            <!-- Calendar Body (Planning Grid) -->
            <div id="calendar-body" class="flex-1 calendar-scroll">
                <div id="calendar-grid" class="relative min-w-max">
                    <!-- 1. Grid Background Layer (Managed by Vanilla JS) -->
                    <div id="grid-background-layer" class="absolute inset-0 z-0">
                        <!-- Grid cells injected here -->
                    </div>

                    <!-- 2. Tasks Layer (Managed by Svelte) -->
                    <div id="tasks-layer" class="absolute inset-0 z-10 pointer-events-none">
                        <!-- Tasks rendered by Svelte loop -->
                        {#each tasks as task (task.id)}
                            {#if getTaskStyle(task)}
                                <Task 
                                    {task}
                                    style={getTaskStyle(task)}
                                    onDragStart={(e) => handleDragStart(e)}
                                    onDragEnd={(e) => handleDragEnd(e)}
                                    {formatDate}
                                />
                            {/if}
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Loading Modal -->
    <div id="loading-modal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-6 rounded-lg shadow-xl">
            <div class="text-lg font-semibold">Loading Planner...</div>
        </div>
    </div>

    <!-- Task Tooltip -->
    <Tooltip />

<script>
    import { onMount, tick } from 'svelte';
    import Tooltip from '$lib/components/Tooltip.svelte';
    import Task from '$lib/components/Task.svelte';
    import { tooltipStore } from '$lib/stores/tooltipStore.svelte.js';

    // === 1. TOP LEVEL STATE ===
    let tasks = $state([]);
    let calendarDays = $state([]);
    let lines = $state([]);
    
    // === 2. MOCK DATA & CONSTANTS ===
    const MOCK_LINES = [
        { id: 'line-1', name: 'Line 01' },
        { id: 'line-2', name: 'Line 02' },
        { id: 'line-3', name: 'Line 03' },
        { id: 'line-4', name: 'Line 04 (Sewing)' },
        { id: 'line-5', name: 'Line 05' },
        { id: 'line-6', name: 'Line 06 (Sewing)' },
        { id: 'line-7', name: 'Line 07 (Finishing)' },
        { id: 'line-8', name: 'Line 08' },
    ];

    const MOCK_TASKS = [
        {
            id: 'task-101',
            lineId: 'line-1',
            orderId: 'PO-4567',
            style: 'T-Shirt (Red)',
            quantity: 500,
            start: '2025-11-01T09:00:00',
            end: '2025-11-01T13:30:00'
        },
        {
            id: 'task-102',
            lineId: 'line-1',
            orderId: 'PO-4568',
            style: 'Polo (Blue)',
            quantity: 300,
            start: '2025-11-01T14:00:00',
            end: '2025-11-01T17:00:00'
        },
        {
            id: 'task-103',
            lineId: 'line-2',
            orderId: 'PO-4569',
            style: 'Jeans (Black)',
            quantity: 1200,
            start: '2025-11-03T09:00:00',
            end: '2025-11-06T17:00:00'
        },
        {
            id: 'task-104',
            lineId: 'line-3',
            orderId: 'PO-4570',
            style: 'Jacket (Denim)',
            quantity: 250,
            start: '2025-11-03T11:30:00',
            end: '2025-11-03T16:00:00'
        },
        {
            id: 'task-105',
            lineId: 'line-4',
            orderId: 'PO-4571',
            style: 'Shorts (Cargo)',
            quantity: 800,
            start: '2025-11-05T10:00:00',
            end: '2025-11-05T18:00:00'
        }
    ];

    const MOCK_HOLIDAYS = [
        '2025-12-16', 
        '2025-12-25', 
        '2026-01-01', 
    ];

    let holidays = [...MOCK_HOLIDAYS];
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    let NUM_DAYS_TO_SHOW = 60;
    const DAY_COLUMN_WIDTH = 200;
    const ROW_HEIGHT = 100;
    const START_HOUR = 8;
    const END_HOUR = 18;

    // === 3. Drag & Drop State ===
    let draggedTaskId = null;
    let originalLineId = null;
    let draggedTaskDuration = 0;
    let ghostTaskElement = null;

    // === 4. TOP LEVEL HELPERS ===
    function getWorkHoursPerDay(dayOfWeek) {
        switch (dayOfWeek) {
            case 0: return 0; // Sunday (Weekend)
            case 5: return 8; // Friday (Shorter day)
            case 6: return 0; // Saturday (Weekend)
            default: return 10; // Weekday (Mon-Thurs)
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

    function getPixelOffsetForDate(date) {
        const dateObj = new Date(date);
        const dateStr = formatDate(dateObj, 'YYYY-MM-DD');
        const dayIndex = calendarDays.findIndex(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
        
        // Not on calendar
        if (dayIndex === -1) return null;

        const day = calendarDays[dayIndex];
        
        // If date is on a blocked day, we can't calculate a time-based offset.
        if (day.isBlocked || day.workHours === 0) {
            // Snap to the start of the day block
            return dayIndex * DAY_COLUMN_WIDTH;
        }

        const totalWorkMinutes = day.workHours * 60;
        const dayWorkStart = new Date(day.date);
        dayWorkStart.setHours(START_HOUR, 0, 0, 0);

        const dayWorkEnd = new Date(dayWorkStart.getTime() + day.workHours * 60 * 60000);

        // Clamp task time to workday
        const effectiveTime = new Date(Math.max(dayWorkStart.getTime(), Math.min(dayWorkEnd.getTime(), dateObj.getTime())));

        let taskOffsetMinutes = (effectiveTime.getTime() - dayWorkStart.getTime()) / (1000 * 60);

        const leftPercent = (taskOffsetMinutes / totalWorkMinutes);
        const leftPixelOffset = leftPercent * DAY_COLUMN_WIDTH;

        return (dayIndex * DAY_COLUMN_WIDTH) + leftPixelOffset;
    }

    function getTaskStyle(task) {
        const taskStart = new Date(task.start);
        const taskEnd = new Date(task.end);
        const lineIndex = lines.findIndex(l => l.id === task.lineId);

        if (lineIndex === -1) return '';

        const startPixel = getPixelOffsetForDate(taskStart);
        if (startPixel === null) return '';

        let endPixel = getPixelOffsetForDate(taskEnd);
        if (endPixel === null) {
            const lastDayIndex = calendarDays.length - 1;
            endPixel = (lastDayIndex * DAY_COLUMN_WIDTH) + DAY_COLUMN_WIDTH;
        }

        const width = endPixel - startPixel;
        if (width <= 0) return '';

        const top = (lineIndex * ROW_HEIGHT) + 10;
        
        return `left: ${startPixel}px; top: ${top}px; width: ${width}px; height: ${ROW_HEIGHT - 20}px;`;
    }

    function calculateNewEndDate(newStartDate, workDurationMinutes) {
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
            
            if (!currentDay.isBlocked && currentDay.workHours > 0) {
                const dayWorkStart = new Date(currentDay.date);
                dayWorkStart.setHours(START_HOUR, 0, 0, 0);
                
                const dayWorkEnd = new Date(dayWorkStart.getTime() + currentDay.workHours * 60 * 60000);

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

    // === 5. EVENT HANDLERS ===
    function handleDragStart(e) {
        const realTaskId = e.target.dataset.taskId;
        if (!realTaskId) {
            console.error("Dragged element is not a task.");
            e.preventDefault();
            return;
        }

        draggedTaskId = realTaskId;
        const task = tasks.find(t => t.id === draggedTaskId);
        originalLineId = task.lineId;
        
        const taskRect = e.target.getBoundingClientRect();
        const taskOffsetLeft = e.clientX - taskRect.left;

        const taskStart = new Date(task.start);
        const taskEnd = new Date(task.end);
        
        draggedTaskDuration = 0; 
        let tempDate = new Date(taskStart);
        tempDate.setHours(0,0,0,0); 
        
        while(tempDate < taskEnd) {
            const dateStr = formatDate(tempDate, 'YYYY-MM-DD');
            const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

            if (day && !day.isBlocked && day.workHours > 0) {
                const dayWorkStart = new Date(day.date);
                dayWorkStart.setHours(START_HOUR, 0, 0, 0);
                const dayWorkEnd = new Date(dayWorkStart.getTime() + day.workHours * 60 * 60000);

                const segmentStart = new Date(Math.max(taskStart.getTime(), dayWorkStart.getTime()));
                const segmentEnd = new Date(Math.min(taskEnd.getTime(), dayWorkEnd.getTime()));

                if (segmentEnd > segmentStart) {
                    draggedTaskDuration += (segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60);
                }
            }
            tempDate.setDate(tempDate.getDate() + 1);
        }
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            id: draggedTaskId,
            durationMinutes: draggedTaskDuration,
            taskOffsetLeft: taskOffsetLeft
        }));
        
        setTimeout(() => {
            e.target.classList.add('dragging');
        }, 0);

        if (ghostTaskElement) ghostTaskElement.remove();
        ghostTaskElement = document.createElement('div');
        ghostTaskElement.id = 'ghost-task';
        const taskEl = e.target;
        ghostTaskElement.style.top = taskEl.style.top;
        ghostTaskElement.style.left = taskEl.style.left;
        ghostTaskElement.style.width = taskEl.style.width;
        ghostTaskElement.style.height = taskEl.style.height;
        ghostTaskElement.classList.add('valid'); 
        
        // Append ghost to grid
        const grid = document.getElementById('calendar-grid');
        if (grid) grid.appendChild(ghostTaskElement);
    }

    function handleDragOver(e) {
        e.preventDefault();
        const targetCell = e.target.closest('.grid-cell');
        if (!targetCell || !ghostTaskElement) return;

        const newLineId = targetCell.dataset.lineId;
        const dateStr = targetCell.dataset.date;
        const isBlocked = targetCell.dataset.isBlocked === 'true';

        const data = e.dataTransfer.getData('text/plain');
        if (!data) return; 
        
        const { id: droppedTaskId, durationMinutes: workDurationMinutes, taskOffsetLeft } = JSON.parse(data);
        const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
        
        if (isBlocked || !day || day.workHours === 0) {
            ghostTaskElement.classList.remove('valid');
            ghostTaskElement.classList.add('invalid');
            e.dataTransfer.dropEffect = 'none';
            targetCell.classList.add('drag-over'); 
            return;
        }

        const totalWorkMinutes = day.workHours * 60;
        const cellRect = targetCell.getBoundingClientRect();
        const ghostStartX = e.clientX - taskOffsetLeft;
        const dropX = ghostStartX - cellRect.left; 
        const percentOffset = Math.max(0, Math.min(1, dropX / DAY_COLUMN_WIDTH));
        let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);
        
        const newStartDate = new Date(`${dateStr}T00:00:00`);
        newStartDate.setHours(START_HOUR);
        newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);

        const newEndDate = calculateNewEndDate(newStartDate, workDurationMinutes);
        const hasOverlap = isOverlapping(droppedTaskId, newLineId, newStartDate, newEndDate);
        
        const startPixel = getPixelOffsetForDate(newStartDate);
        const endPixel = getPixelOffsetForDate(newEndDate);
        
        if (startPixel === null || endPixel === null) {
            ghostTaskElement.classList.remove('valid');
            ghostTaskElement.classList.add('invalid');
            e.dataTransfer.dropEffect = 'none';
            return;
        }

        const newWidth = endPixel - startPixel;
        const lineIndex = lines.findIndex(l => l.id === newLineId);
        const newTop = (lineIndex * ROW_HEIGHT) + 10;
        
        ghostTaskElement.style.left = `${startPixel}px`;
        ghostTaskElement.style.width = `${newWidth}px`;
        ghostTaskElement.style.top = `${newTop}px`;

        if (hasOverlap) {
            ghostTaskElement.classList.remove('valid');
            ghostTaskElement.classList.add('invalid');
            e.dataTransfer.dropEffect = 'none';
        } else {
            ghostTaskElement.classList.remove('invalid');
            ghostTaskElement.classList.add('valid');
            e.dataTransfer.dropEffect = 'move';
        }
        targetCell.classList.add('drag-over');
    }

    function handleDragEnd(e) {
        if (ghostTaskElement) {
            ghostTaskElement.remove();
            ghostTaskElement = null;
        }
        if (draggedTaskId) {
            // Because of Svelte re-render, class removal might be automatic or handled by component
        }
        draggedTaskId = null;
        originalLineId = null;
    }

    function handleDragLeave(e) {
        const targetCell = e.target.closest('.grid-cell');
        if (targetCell) {
            targetCell.classList.remove('drag-over');
        }
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

        const { id: droppedTaskId, durationMinutes: workDurationMinutes, taskOffsetLeft } = JSON.parse(e.dataTransfer.getData('text/plain'));

        if (isBlocked) {
            console.warn("Cannot drop on a blocked day!");
            return;
        }
        
        const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
        if (!day || day.workHours === 0) {
            console.warn("Cannot drop on non-working day.");
            return;
        }

        const totalWorkMinutes = day.workHours * 60;
        const cellRect = targetCell.getBoundingClientRect();
        const ghostStartX = e.clientX - taskOffsetLeft;
        const dropX = ghostStartX - cellRect.left; 
        const percentOffset = Math.max(0, Math.min(1, dropX / DAY_COLUMN_WIDTH));
        let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);

        const newStartDate = new Date(`${dateStr}T00:00:00`);
        newStartDate.setHours(START_HOUR);
        newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);

        let newEndDate = calculateNewEndDate(newStartDate, workDurationMinutes);

        if (isOverlapping(droppedTaskId, newLineId, newStartDate, newEndDate)) {
            console.warn("DROP REJECTED: Task would overlap with another task.");
            return;
        }

        if (newLineId && droppedTaskId) {
            const taskIndex = tasks.findIndex(t => t.id === droppedTaskId);
            if (taskIndex !== -1) {
                // Mutate state directly
                tasks[taskIndex].lineId = newLineId;
                tasks[taskIndex].start = newStartDate.toISOString();
                tasks[taskIndex].end = newEndDate.toISOString();
                
                // No need to call renderBoard() for tasks, Svelte handles it!
                // We might need to handle ghost cleanup if strict
            }
        }
    }


    onMount(() => {
        // Init state
        lines = [...MOCK_LINES];
        tasks = [...MOCK_TASKS];

        const sidebarRows = document.getElementById('sidebar-rows');
        const calendarDates = document.getElementById('calendar-dates');
        const calendarGrid = document.getElementById('calendar-grid');
        const loadingModal = document.getElementById('loading-modal');

        function renderBoard() {
            // Note: renderBoard now mainly handles the BACKGROUND GRID and SIDEBAR
            // TASKS are reactive and handled by Svelte in #tasks-layer.
            
            console.log("Rendering board (background only)...");
            
            // 1. Clear SIDEBAR
            sidebarRows.innerHTML = '';
            
            // 2. Clear CALENDAR HEADER
            calendarDates.innerHTML = '';

            // 3. Clear GRID BACKGROUND ONLY
            // We do NOT touch calendarGrid.innerHTML because that would kill the #tasks-layer!
            const gridBackgroundLayer = document.getElementById('grid-background-layer');
            if (gridBackgroundLayer) {
                gridBackgroundLayer.innerHTML = '';
            }
            
            // RE-POPULATE calendarDays
            calendarDays = []; 
            const currentDate = new Date(today);
            for (let i = 0; i < NUM_DAYS_TO_SHOW; i++) {
                const date = new Date(currentDate);
                const dayOfWeek = date.getDay();
                const workHours = getWorkHoursPerDay(dayOfWeek);
                const isWeekend = workHours === 0;
                const isHoliday = holidays.includes(formatDate(date, 'YYYY-MM-DD'));
                const isBlocked = isWeekend || isHoliday;

                calendarDays.push({
                    date,
                    dayOfWeek,
                    workHours,
                    isBlocked,
                    isToday: i === 0
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }

            // Render Sidebar
            lines.forEach(line => {
                const rowEl = document.createElement('div');
                rowEl.className = 'flex items-center p-4 border-b border-gray-200';
                rowEl.style.height = `${ROW_HEIGHT}px`;
                rowEl.textContent = line.name;
                sidebarRows.appendChild(rowEl);
            });

            // Render Dates
            calendarDays.forEach((day) => {
                const dateEl = document.createElement('div');
                dateEl.className = `flex-shrink-0 text-center border-l border-b border-gray-200 p-2 ${day.isBlocked ? 'bg-gray-200 text-gray-500' : 'bg-white'} ${day.isToday ? 'bg-blue-100' : ''}`;
                dateEl.style.width = `${DAY_COLUMN_WIDTH}px`;
                dateEl.innerHTML = `
                    <div class="font-semibold text-sm ${day.isToday ? 'text-blue-700' : 'text-gray-800'}">
                        ${formatDate(day.date, 'ddd')}
                    </div>
                    <div class="text-xl font-bold ${day.isToday ? 'text-blue-900' : 'text-gray-900'}">
                        ${day.date.getDate()}
                    </div>
                    <div class="text-xs text-gray-500">
                        ${formatDate(day.date, 'MMM YYYY')}
                    </div>
                    <div class="text-xs font-medium mt-1 ${day.isBlocked ? 'text-red-600' : 'text-green-600'}">
                        ${day.isBlocked ? (day.isHoliday ? 'Holiday' : 'Weekend') : `${day.workHours} Hours`}
                    </div>
                `;
                calendarDates.appendChild(dateEl);
            });

            // Render Grid Background Cells
            if (gridBackgroundLayer) {
                let gridCellsFrag = document.createDocumentFragment();
                
                calendarDays.forEach((day, dayIndex) => {
                    let gridLinesFaint = 'none';
                    let gridLinesStrong = 'none';
                    if (day.workHours > 0) {
                        const percentPerHr = 100 / day.workHours;
                        gridLinesFaint = `repeating-linear-gradient(to right, #f0f0f0 0, #f0f0f0 1px, transparent 1px, transparent ${percentPerHr}%)`;
                        gridLinesStrong = `repeating-linear-gradient(to right, #a5b4fc 0, #a5b4fc 1px, transparent 1px, transparent ${percentPerHr}%)`;
                    }
                    
                    lines.forEach((line, lineIndex) => {
                        const cellId = `cell-${line.id}-${formatDate(day.date, 'YYYY-MM-DD')}`;
                        const cell = document.createElement('div');
                        cell.id = cellId;
                        // Use pointer-events-auto so we can drag over them, 
                        // even though tasks layer is on top with pointer-events-none (for the container)
                        cell.className = `grid-cell absolute border-r border-b border-gray-200 ${day.isBlocked ? 'bg-gray-100' : 'bg-white'}`;
                        cell.style.left = `${dayIndex * DAY_COLUMN_WIDTH}px`;
                        cell.style.top = `${lineIndex * ROW_HEIGHT}px`;
                        cell.style.width = `${DAY_COLUMN_WIDTH}px`;
                        cell.style.height = `${ROW_HEIGHT}px`;
                        cell.style.setProperty('--grid-lines-faint', gridLinesFaint);
                        cell.style.setProperty('--grid-lines-strong', gridLinesStrong);
                        cell.dataset.lineId = line.id;
                        cell.dataset.date = formatDate(day.date, 'YYYY-MM-DD');
                        cell.dataset.isBlocked = day.isBlocked;
                        
                        gridCellsFrag.appendChild(cell);
                    });
                });
                gridBackgroundLayer.appendChild(gridCellsFrag);
            }

            // Load More Button
            const loadMoreButton = document.createElement('div');
            loadMoreButton.className = `flex-shrink-0 text-center border-l border-b border-gray-200 p-2 bg-gray-50 hover:bg-gray-100 cursor-pointer flex flex-col justify-center items-center`;
            loadMoreButton.style.width = `120px`; 
            loadMoreButton.innerHTML = `
                <div class="font-semibold text-sm text-blue-600">Load More</div>
                <div class="text-xs text-gray-500 mt-2">(${NUM_DAYS_TO_SHOW} days shown)</div>
            `;
            loadMoreButton.addEventListener('click', () => {
                NUM_DAYS_TO_SHOW += 30; 
                loadingModal.style.display = 'flex'; 
                setTimeout(() => renderBoard(), 50); 
            });
            calendarDates.appendChild(loadMoreButton);

            addDragDropListeners(); 
            // addDateNavListeners(); // Already called once in onMount
            
            loadingModal.style.display = 'none';
            console.log("Render complete.");
        }
        
        function addDragDropListeners() {
             // Re-attach listeners to NEW grid cells
             const cells = calendarGrid.querySelectorAll('.grid-cell');
             cells.forEach(cell => {
                 cell.addEventListener('dragover', handleDragOver);
                 cell.addEventListener('dragleave', handleDragLeave);
                 cell.addEventListener('drop', handleDrop);
             });
        }

        function addDateNavListeners() {
            // ... (keep logic, but update refs since we cleared innerHTML)
            // But wait, the date nav INPUTS are in the SIDEBAR HEADER which is STATIC HTML.
            // lines 9-14 in template. They are NOT cleared by renderBoard (sidebarRows is cleared).
            // So we only need to add listeners ONCE, not every render.
            // Move this out of renderBoard or check if added?
            // Actually, just add them once in onMount.
            
            const btnDate = document.getElementById('go-to-date-btn');
            const btnToday = document.getElementById('go-to-today-btn');
            
            // Remove old listeners? No easy way. 
            // Better to clone node or just ensure we don't multiply.
            // Or just do it once here in onMount.
            
            btnDate.onclick = () => {
                 const datePicker = document.getElementById('date-picker');
                 if (datePicker.value) {
                     const newDate = new Date(datePicker.value + 'T00:00:00'); 
                     today = newDate;
                     today.setHours(0, 0, 0, 0);
                     loadingModal.style.display = 'flex';
                     setTimeout(() => renderBoard(), 50);
                 }
            };

             btnToday.onclick = () => {
                 const newToday = new Date();
                 newToday.setHours(0, 0, 0, 0);
                 today = newToday;
                 const datePicker = document.getElementById('date-picker');
                 if (datePicker) datePicker.value = '';
                 loadingModal.style.display = 'flex';
                 setTimeout(() => renderBoard(), 50);
             };
        }

        function alignMockDataToToday() {
             const todayStr = formatDate(today, 'YYYY-MM-DD');
             
             // Mutate state
             const task101 = tasks.find(t => t.id === 'task-101');
             if (task101) {
                 task101.start = `${todayStr}T09:00:00`;
                 task101.end = `${todayStr}T13:30:00`;
             }
             const task102 = tasks.find(t => t.id === 'task-102');
             if (task102) {
                 task102.start = `${todayStr}T14:00:00`;
                 task102.end = `${todayStr}T17:00:00`;
             }
        }
        
        // Initial setup
        addDateNavListeners(); // Add once
        
        setTimeout(() => {
            alignMockDataToToday();
            renderBoard();
        }, 500);

    });
</script>
