
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
                    <!-- Grid background (cells) and tasks will be injected by JS -->
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
    <div id="tooltip" class="fixed z-50 hidden px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm" role="tooltip">
        <!-- Tooltip content will be injected by JS -->
    </div>

<script>
    import { onMount } from 'svelte';

    onMount(() => {

            // === 1. MOCK DATA (This would come from your API) ===
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
                // NOTE: This prototype simplifies tasks to START and END within the *same day*.
                // A full app would need to "split" tasks that span multiple days (like Task 3) into multiple visual blocks.
                {
                    id: 'task-101',
                    lineId: 'line-1',
                    orderId: 'PO-4567',
                    style: 'T-Shirt (Red)',
                    quantity: 500,
                    // Specific start/end times
                    start: '2025-11-01T09:00:00', // Uses current date for demo
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
                    start: '2025-11-03T09:00:00', // Monday
                    end: '2025-11-06T17:00:00' // Spans to Thursday
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
                '2025-12-16', // Victory Day (Example)
                '2025-12-25', // Christmas
                '2026-01-01', // New Year's Day
            ];

            // === 2. CONFIGURATION ===
            let NUM_DAYS_TO_SHOW = 60; // Total days to render (changed to let)
            const DAY_COLUMN_WIDTH = 200; // Width of each day column in pixels
            const ROW_HEIGHT = 100; // Height of each line row in pixels
            const START_HOUR = 8; // Workday starts at 8 AM
            const END_HOUR = 18; // Workday ends at 6 PM (10 hour base)

            // This function defines your variable work hours per day
            // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            function getWorkHoursPerDay(dayOfWeek) {
                switch (dayOfWeek) {
                    case 0: return 0; // Sunday (Weekend)
                    case 5: return 8; // Friday (Shorter day)
                    case 6: return 0; // Saturday (Weekend)
                    default: return 10; // Weekday (Mon-Thurs)
                }
            }

            // === 3. STATE & GLOBAL VARS ===
            let tasks = [...MOCK_TASKS]; // Local copy to mutate
            let lines = [...MOCK_LINES];
            let holidays = [...MOCK_HOLIDAYS];
            let today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to start of day
            let calendarDays = []; // Make calendarDays globally accessible

            // DOM Element Refs
            const sidebarRows = document.getElementById('sidebar-rows');
            const calendarDates = document.getElementById('calendar-dates');
            const calendarGrid = document.getElementById('calendar-grid');
            const tooltip = document.getElementById('tooltip');
            const loadingModal = document.getElementById('loading-modal');


            // === 4. MAIN RENDER FUNCTION ===
            function renderBoard() {
                console.log("Rendering board...");
                // Clear existing content
                sidebarRows.innerHTML = '';
                calendarDates.innerHTML = '';
                calendarGrid.innerHTML = '';

                calendarDays = []; // Clear and re-populate global calendarDays

                // --- A. Generate Calendar Days ---
                const currentDate = new Date(today); // Start from today
                for (let i = 0; i < NUM_DAYS_TO_SHOW; i++) {
                    const date = new Date(currentDate); // Create a new object for the array
                    
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
                    
                    // Increment currentDate for the next loop iteration
                    currentDate.setDate(currentDate.getDate() + 1);
                }

                // --- B. Render Sidebar (Lines) ---
                lines.forEach(line => {
                    const rowEl = document.createElement('div');
                    rowEl.className = 'flex items-center p-4 border-b border-gray-200';
                    rowEl.style.height = `${ROW_HEIGHT}px`;
                    rowEl.textContent = line.name;
                    sidebarRows.appendChild(rowEl);
                });

                // --- C. Render Calendar Header (Dates) & Grid Background ---
                let gridCellsHTML = '';
                calendarDays.forEach((day, dayIndex) => {
                    // Render Header Cell
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

                    // --- Create background grid cells ---
                    // Create gradient strings for visual grid lines
                    let gridLinesFaint = 'none';
                    let gridLinesStrong = 'none';
                    if (day.workHours > 0) {
                        const percentPerHr = 100 / day.workHours;
                        gridLinesFaint = `repeating-linear-gradient(to right, #f0f0f0 0, #f0f0f0 1px, transparent 1px, transparent ${percentPerHr}%)`;
                        gridLinesStrong = `repeating-linear-gradient(to right, #a5b4fc 0, #a5b4fc 1px, transparent 1px, transparent ${percentPerHr}%)`;
                    }
                    
                    lines.forEach((line, lineIndex) => {
                        const cellId = `cell-${line.id}-${formatDate(day.date, 'YYYY-MM-DD')}`;
                        gridCellsHTML += `
                            <div id="${cellId}"
                                 class="grid-cell absolute border-r border-b border-gray-200 ${day.isBlocked ? 'bg-gray-100' : 'bg-white'}"
                                 style="left: ${dayIndex * DAY_COLUMN_WIDTH}px; top: ${lineIndex * ROW_HEIGHT}px; width: ${DAY_COLUMN_WIDTH}px; height: ${ROW_HEIGHT}px; --grid-lines-faint: ${gridLinesFaint}; --grid-lines-strong: ${gridLinesStrong};"
                                 data-line-id="${line.id}"
                                 data-date="${formatDate(day.date, 'YYYY-MM-DD')}"
                                 data-is-blocked="${day.isBlocked}">
                            </div>
                        `;
                    });
                });
                calendarGrid.innerHTML = gridCellsHTML;

                // === NEW: Add Load More Button ===
                const loadMoreButton = document.createElement('div');
                loadMoreButton.className = `flex-shrink-0 text-center border-l border-b border-gray-200 p-2 bg-gray-50 hover:bg-gray-100 cursor-pointer flex flex-col justify-center items-center`;
                loadMoreButton.style.width = `120px`; // A bit wider
                loadMoreButton.innerHTML = `
                    <div class="font-semibold text-sm text-blue-600">Load More</div>
                    <div class="text-xs text-gray-500 mt-2">(${NUM_DAYS_TO_SHOW} days shown)</div>
                `;
                loadMoreButton.addEventListener('click', () => {
                    NUM_DAYS_TO_SHOW += 30; // Load 30 more days
                    loadingModal.style.display = 'flex'; // Show loading modal
                    setTimeout(() => renderBoard(), 50); // Re-render with new total
                });
                calendarDates.appendChild(loadMoreButton);


                // --- D. Render Tasks ---
                tasks.forEach(task => {
                    const taskStart = new Date(task.start);
                    const taskEnd = new Date(task.end);
                    const lineIndex = lines.findIndex(l => l.id === task.lineId);
                
                    if (lineIndex === -1) {
                        console.warn('Task line not found:', task.id);
                        return;
                    }

                    // --- NEW LOGIC: Calculate start and end pixel positions ---
                    
                    // 1. Find Start Pixel
                    const startPixel = getPixelOffsetForDate(taskStart);
                    
                    if (startPixel === null) {
                        // Task starts before or on a blocked day at the edge of the visible range
                        console.warn('Could not calculate start pixel for task:', task.id);
                        return;
                    }

                    // 2. Find End Pixel
                    let endPixel = getPixelOffsetForDate(taskEnd);

                    if (endPixel === null) {
                        // Task ends after or on a blocked day at the edge of the visible range
                        console.warn('Could not calculate end pixel for task:', task.id);
                        // For now, let's assume it ends at the end of the calendar
                        const lastDayIndex = calendarDays.length - 1;
                        endPixel = (lastDayIndex * DAY_COLUMN_WIDTH) + DAY_COLUMN_WIDTH;
                    }

                    // 3. Calculate width
                    const width = endPixel - startPixel;
                    if (width <= 0) {
                        console.warn('Task has zero or negative width:', task.id);
                        return;
                    }

                    // 4. Create Task Element
                    const taskEl = document.createElement('div');
                    taskEl.dataset.taskId = task.id; // Store the *real* task ID
                    taskEl.id = `${task.id}-task`; // Only one element per task
                    taskEl.className = 'task absolute bg-blue-600 border border-blue-800 rounded-lg p-2 text-white shadow-md overflow-hidden cursor-grab active:cursor-grabbing';
                    
                    taskEl.style.left = `${startPixel}px`;
                    taskEl.style.top = `${(lineIndex * ROW_HEIGHT) + 10}px`; // 10px margin
                    taskEl.style.width = `${width}px`;
                    taskEl.style.height = `${ROW_HEIGHT - 20}px`; // 10px top/bottom margin
                    taskEl.setAttribute('draggable', 'true');
                    
                    taskEl.innerHTML = `
                        <div class="font-bold text-sm truncate">${task.orderId}</div>
                        <div class="text-xs truncate">${task.style}</div>
                        <div class="text-xs truncate">Qty: ${task.quantity}</div>
                    `;

                    // Tooltip always shows the FULL task details
                    taskEl.dataset.tooltipContent = `
                        <strong>Order:</strong> ${task.orderId}<br>
                        <strong>Style:</strong> ${task.style}<br>
                        <strong>Qty:</strong> ${task.quantity}<br>
                        <strong>Start:</strong> ${formatDate(taskStart, 'YYYY-MM-DD HH:mm')}<br>
                        <strong>End:</strong> ${formatDate(taskEnd, 'YYYY-MM-DD HH:mm')}
                    `;
        
                    calendarGrid.appendChild(taskEl);
                });


                // --- E. Add Event Listeners ---
                addDragDropListeners();
                addTooltipListeners();
                addDateNavListeners(); // NEW: Add listeners for date nav
                
                loadingModal.style.display = 'none';
                console.log("Render complete.");
            }


            // === 5. EVENT HANDLERS ===

            // --- Drag & Drop ---
            let draggedTaskId = null;
            let originalLineId = null;
            let draggedTaskDuration = 0; // Store duration in minutes
            let ghostTaskElement = null; // Our new ghost element
            // No longer need global offset: let draggedTaskOffset = 0; 

            function addDragDropListeners() {
                const tasks = document.querySelectorAll('.task');
                tasks.forEach(task => {
                    task.addEventListener('dragstart', handleDragStart);
                    task.addEventListener('dragend', handleDragEnd);
                });

                const cells = document.querySelectorAll('#calendar-grid div[data-line-id]');
                cells.forEach(cell => {
                    cell.addEventListener('dragover', handleDragOver);
                    cell.addEventListener('dragleave', handleDragLeave);
                    cell.addEventListener('drop', handleDrop);
                });
            }

            function handleDragStart(e) {
                // Find the *real* task ID from the element's data attribute
                const realTaskId = e.target.dataset.taskId;
                if (!realTaskId) {
                    console.error("Dragged element is not a task.");
                    e.preventDefault();
                    return;
                }

                draggedTaskId = realTaskId;
                const task = tasks.find(t => t.id === draggedTaskId);
                originalLineId = task.lineId;
                
                // === NEW: Calculate cursor offset ===
                const taskRect = e.target.getBoundingClientRect();
                const taskOffsetLeft = e.clientX - taskRect.left;

                const taskStart = new Date(task.start);
                const taskEnd = new Date(task.end);
                
                // === NEW DURATION LOGIC: Calculate *Work Minutes* ===
                draggedTaskDuration = 0; // This will be in *work minutes*
                let tempDate = new Date(taskStart);
                tempDate.setHours(0,0,0,0); // Start check from the beginning of the start day
                
                while(tempDate < taskEnd) {
                    const dateStr = formatDate(tempDate, 'YYYY-MM-DD');
                    // Find the day in our calendar definition
                    const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

                    if (day && !day.isBlocked && day.workHours > 0) {
                        const dayWorkStart = new Date(day.date);
                        dayWorkStart.setHours(START_HOUR, 0, 0, 0);
                        const dayWorkEnd = new Date(dayWorkStart.getTime() + day.workHours * 60 * 60000);

                        // Find the intersection of the task and the workday
                        const segmentStart = new Date(Math.max(taskStart.getTime(), dayWorkStart.getTime()));
                        const segmentEnd = new Date(Math.min(taskEnd.getTime(), dayWorkEnd.getTime()));

                        if (segmentEnd > segmentStart) {
                            draggedTaskDuration += (segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60);
                        }
                    }
                    
                    // Move to the next day
                    tempDate.setDate(tempDate.getDate() + 1);
                }
                
                console.log("Calculated work duration (minutes):", draggedTaskDuration);
                
                e.dataTransfer.effectAllowed = 'move';
                // Store ID, *work* duration, and cursor offset
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    id: draggedTaskId,
                    durationMinutes: draggedTaskDuration, // This is now work minutes
                    taskOffsetLeft: taskOffsetLeft
                }));
                
                // Use setTimeout to apply class after drag image is created
                setTimeout(() => {
                    e.target.classList.add('dragging');
                    // pointer-events is now handled by CSS
                }, 0);

                // === NEW: Create Ghost Task ===
                if (ghostTaskElement) ghostTaskElement.remove();
                ghostTaskElement = document.createElement('div');
                ghostTaskElement.id = 'ghost-task';
                const taskEl = e.target;
                ghostTaskElement.style.top = taskEl.style.top;
                ghostTaskElement.style.left = taskEl.style.left;
                ghostTaskElement.style.width = taskEl.style.width;
                ghostTaskElement.style.height = taskEl.style.height;
                ghostTaskElement.classList.add('valid'); // Start as valid
                calendarGrid.appendChild(ghostTaskElement);
            }

            function handleDragOver(e) {
                e.preventDefault();
                // Find the parent grid cell
                const targetCell = e.target.closest('.grid-cell');
                if (!targetCell || !ghostTaskElement) return;

                const newLineId = targetCell.dataset.lineId;
                const dateStr = targetCell.dataset.date;
                const isBlocked = targetCell.dataset.isBlocked === 'true';

                // Get data from dragStart (we just need to read)
                const data = e.dataTransfer.getData('text/plain');
                if (!data) return; // Not a valid drag
                
                const { id: droppedTaskId, durationMinutes: workDurationMinutes, taskOffsetLeft } = JSON.parse(data);

                // Find the day object to get workHours
                const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
                
                if (isBlocked || !day || day.workHours === 0) {
                    ghostTaskElement.classList.remove('valid');
                    ghostTaskElement.classList.add('invalid');
                    e.dataTransfer.dropEffect = 'none';
                    // We still show the grid lines, so don't add drag-over-invalid to cell
                    targetCell.classList.add('drag-over'); // Show grid lines
                    return; // Can't drop here, ghost turns red
                }

                // === Calculate Start & End (same as drop) ===
                const totalWorkMinutes = day.workHours * 60;
                const cellRect = targetCell.getBoundingClientRect();
                const ghostStartX = e.clientX - taskOffsetLeft;
                const dropX = ghostStartX - cellRect.left; 
                const percentOffset = Math.max(0, Math.min(1, dropX / DAY_COLUMN_WIDTH));
                let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);
                
                const newStartDate = new Date(`${dateStr}T00:00:00`);
                newStartDate.setHours(START_HOUR);
                newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);

                // Calculate new End Date based on work duration
                const newEndDate = calculateNewEndDate(newStartDate, workDurationMinutes);

                // === Check for Overlap (same as drop) ===
                const hasOverlap = isOverlapping(droppedTaskId, newLineId, newStartDate, newEndDate);
                
                // === Update Ghost Position & Appearance ===
                const startPixel = getPixelOffsetForDate(newStartDate);
                const endPixel = getPixelOffsetForDate(newEndDate);
                
                if (startPixel === null || endPixel === null) {
                    // Dragged out of calendar bounds
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

                // Set visual feedback (color and cursor)
                if (hasOverlap) {
                    ghostTaskElement.classList.remove('valid');
                    ghostTaskElement.classList.add('invalid');
                    e.dataTransfer.dropEffect = 'none'; // Show invalid cursor
                } else {
                    ghostTaskElement.classList.remove('invalid');
                    ghostTaskElement.classList.add('valid');
                    e.dataTransfer.dropEffect = 'move';
                }

                // We still add drag-over to show the prominent grid lines on the cell
                targetCell.classList.add('drag-over');
            }
            
            function handleDragLeave(e) {
                const targetCell = e.target.closest('.grid-cell');
                if (targetCell) {
                    targetCell.classList.remove('drag-over');
                    // No need to remove invalid class, it's handled by dragOver
                }
            }

            // [BUGFIX: REMOVED DUPLICATE handleDrop and handleDragLeave FUNCTIONS]
            // The previous code had two 'handleDrop' and 'handleDragLeave' functions.
            // The incorrect, shorter ones have been removed.

            function handleDrop(e) {
                e.preventDefault();
                
                const targetCell = e.target.closest('.grid-cell');
                if (!targetCell) return;

                targetCell.classList.remove('drag-over');
                targetCell.classList.remove('drag-over-invalid');

                const newLineId = targetCell.dataset.lineId;
                const dateStr = targetCell.dataset.date;
                const isBlocked = targetCell.dataset.isBlocked === 'true';

                // Get data from dragStart
                const { id: droppedTaskId, durationMinutes: workDurationMinutes, taskOffsetLeft } = JSON.parse(e.dataTransfer.getData('text/plain'));

                if (isBlocked) {
                    console.warn("Cannot drop on a blocked day!");
                    return;
                }
                
                // Find the day object to get workHours
                const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
                if (!day || day.workHours === 0) {
                    console.warn("Cannot drop on non-working day.");
                    return;
                }

                // === LOGIC: Calculate new start time based on X position ===
                const totalWorkMinutes = day.workHours * 60;
                
                // Get X position relative to the cell
                const cellRect = targetCell.getBoundingClientRect();
                
                // === NEW LOGIC: Calculate dropX based on shadow's start ===
                // 1. Find the ghost's start position on the screen
                const ghostStartX = e.clientX - taskOffsetLeft;
                // 2. Find the ghost's start position relative to the cell
                const dropX = ghostStartX - cellRect.left; 

                // Calculate percentage offset and new start minute
                const percentOffset = Math.max(0, Math.min(1, dropX / DAY_COLUMN_WIDTH));
                let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);

                // Create new Start Date
                const newStartDate = new Date(`${dateStr}T00:00:00`);
                newStartDate.setHours(START_HOUR);
                newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);

                // === NEW LOGIC: Calculate new End Date based on *Work Minutes* ===
                let minutesToDistribute = workDurationMinutes;
                let newEndDate = new Date(newStartDate);
                let currentDayIndex = calendarDays.findIndex(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);

                // === THIS IS THE FUNCTION TO RE-USE ===
                newEndDate = calculateNewEndDate(newStartDate, workDurationMinutes);
                
                if (minutesToDistribute > 0 && currentDayIndex >= calendarDays.length) {
                    console.warn("Could not place full task duration within visible calendar.");
                    // In a real app, you might prevent the drop or extend the calendar
                }

                // === NEW LOGIC: Check for Overlap ===
                if (isOverlapping(droppedTaskId, newLineId, newStartDate, newEndDate)) {
                    console.warn("DROP REJECTED: Task would overlap with another task.");
                    // You could show a visual error to the user here
                    return;
                }

                // All checks passed, update the task
                if (newLineId && droppedTaskId) {
                    const taskIndex = tasks.findIndex(t => t.id === droppedTaskId);
                    if (taskIndex !== -1) {
                        tasks[taskIndex].lineId = newLineId;
                        tasks[taskIndex].start = newStartDate.toISOString();
                        tasks[taskIndex].end = newEndDate.toISOString();
                        
                        console.log(`Task ${droppedTaskId} moved to ${newLineId} at ${newStartDate.toISOString()}`);
                        
                        renderBoard();
                    }
                }
            }

            function handleDragEnd(e) {
                // === NEW: Always remove ghost on drag end ===
                if (ghostTaskElement) {
                    ghostTaskElement.remove();
                    ghostTaskElement = null;
                }

                // Find all segments and remove dragging class
                if (draggedTaskId) {
                    // Only one element to find now
                    const taskEl = document.getElementById(`${draggedTaskId}-task`);
                    if (taskEl) {
                        taskEl.classList.remove('dragging');
                        // pointer-events is automatically restored
                    }
                }
                draggedTaskId = null;
                originalLineId = null;
            }

            // === NEW FUNCTION: Overlap Detection ===
            function isOverlapping(taskIdToIgnore, lineId, newStart, newEnd) {
                // Check against all tasks on the *same line*
                const tasksOnLine = tasks.filter(t => t.lineId === lineId && t.id !== taskIdToIgnore);
                
                for (const task of tasksOnLine) {
                    const existingStart = new Date(task.start);
                    const existingEnd = new Date(task.end);

                    // Standard collision detection logic:
                    // (StartA < EndB) and (EndA > StartB)
                    if (newStart < existingEnd && newEnd > existingStart) {
                        return true; // Overlap found
                    }
                }
                return false; // No overlap
            }

            // === NEW HELPER: Re-usable End Date Calculator ===
            // (Extracted from handleDrop)
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


            // --- Tooltip ---
            function addTooltipListeners() {
                document.querySelectorAll('.task').forEach(task => {
                    task.addEventListener('mouseenter', showTooltip);
                    task.addEventListener('mouseleave', hideTooltip);
                    task.addEventListener('mousemove', moveTooltip);
                });
            }
            
            function showTooltip(e) {
                const content = e.currentTarget.dataset.tooltipContent;
                if (content) {
                    tooltip.innerHTML = content;
                    tooltip.style.display = 'block';
                    moveTooltip(e);
                }
            }
            
            function hideTooltip(e) {
                tooltip.style.display = 'none';
            }

            function moveTooltip(e) {
                // Position tooltip near the cursor
                tooltip.style.left = `${e.pageX + 10}px`;
                tooltip.style.top = `${e.pageY + 10}px`;
            }

            // === 6. HELPER FUNCTIONS ===

            /**
             * Calculates the absolute pixel offset for a given date/time.
             * Returns null if the date is not in the visible calendar.
             */
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
            
            // === 7. INITIALIZATION ===

            // === NEW: Date Navigation Listeners ===
            function addDateNavListeners() {
                document.getElementById('go-to-date-btn').addEventListener('click', () => {
                    const datePicker = document.getElementById('date-picker');
                    if (datePicker.value) {
                        const newDate = new Date(datePicker.value + 'T00:00:00'); // Use local time
                        today = newDate;
                        today.setHours(0, 0, 0, 0);
                        loadingModal.style.display = 'flex';
                        setTimeout(() => renderBoard(), 50);
                    }
                });

                document.getElementById('go-to-today-btn').addEventListener('click', () => {
                    const newToday = new Date();
                    newToday.setHours(0, 0, 0, 0);
                    today = newToday; // Reset global 'today'
                    
                    // Also reset the date picker's value
                    const datePicker = document.getElementById('date-picker');
                    if (datePicker) {
                        datePicker.value = ''; // Clear the picker
                    }

                    loadingModal.style.display = 'flex';
                    setTimeout(() => renderBoard(), 50);
                });
            }
            
            // Simple mock data replacement: Set task 'task-101' and 'task-102' to today's date
            function alignMockDataToToday() {
                const todayStr = formatDate(today, 'YYYY-MM-DD');
                
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
            
            // --- Simulate API call ---
            setTimeout(() => {
                alignMockDataToToday();
                renderBoard();
            }, 500); // 500ms delay to show loading
        
    });
</script>

