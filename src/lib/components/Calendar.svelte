<script>
    import { onMount, tick } from 'svelte';
    import Task from '$lib/components/Task.svelte';

    // Props
    let { 
        tasks = $bindable([]),
        lines = [],
        today = new Date(),
        holidays = [],
        onScroll = () => {}
    } = $props();

    // Internal State
    let calendarDays = $state([]);
    
    // Constants - Default: 30 days before and 30 days after today (60 days total)
    let daysBefore = $state(30);  // Days before today
    let daysAfter = $state(30);   // Days after today
    const DAY_COLUMN_WIDTH = 100;
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
    let originalLineId = null;
    let draggedTaskDuration = 0;
    let ghostTaskElement = null;

    // Helpers
    function getStandardWorkHours(dayOfWeek) {
        switch (dayOfWeek) {
            case 0: return 9; // Sunday (Shorter day)
            case 5: return 0; // Friday (Weekend)
            case 6: return 0; // Saturday (Weekend)
            default: return 10; // Weekday (Mon-Thurs)
        }
    }

    function getLineWorkHours(date, lineId) {
        // 1. Check if it's a blocked day (weekend/holiday)
        // We can check calendarDays but easier to check raw date if we have helpers
        // relying on calendarDays for now for consistency
        const dateStr = formatDate(date, 'YYYY-MM-DD');
        const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
        
        if (day && day.isBlocked) return 0;

        // 2. Variable logic
        if (lineId === 'line-1') return 8;
        if (lineId === 'line-2') return 12;
        
        // Default fallthrough
        const dayOfWeek = date.getDay();
        return getStandardWorkHours(dayOfWeek);
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

        // NEW: Slimmer tasks
        const top = (lineIndex * ROW_HEIGHT) + 4; // 4px padding top
        const height = ROW_HEIGHT - 8; // 4px padding bottom, total 8px gap
        
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
        
        // ABSOLUTE DURATION: Simple difference
        const durationMs = taskEnd.getTime() - taskStart.getTime();
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            id: draggedTaskId,
            durationMs: durationMs,
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
        const height = ROW_HEIGHT - FOOTER_HEIGHT - 10;
        ghostTaskElement.style.height = `${height}px`;
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
        
        const { id: droppedTaskId, durationMs, taskOffsetLeft } = JSON.parse(data);
        const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
        const workHours = getLineWorkHours(new Date(dateStr), newLineId);
        
        if (isBlocked || !day || workHours === 0) {
            ghostTaskElement.classList.remove('valid');
            ghostTaskElement.classList.add('invalid');
            e.dataTransfer.dropEffect = 'none';
            targetCell.classList.add('drag-over'); 
            return;
        }

        const totalWorkMinutes = workHours * 60;
        const cellRect = targetCell.getBoundingClientRect();
        const ghostStartX = e.clientX - taskOffsetLeft;
        const dropX = ghostStartX - cellRect.left; 
        const percentOffset = Math.max(0, Math.min(1, dropX / DAY_COLUMN_WIDTH));
        let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);
        
        const newStartDate = new Date(`${dateStr}T00:00:00`);
        newStartDate.setHours(START_HOUR);
        newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);

        // Simple End Date Calculation
        const newEndDate = new Date(newStartDate.getTime() + durationMs);
        
        const hasOverlap = isOverlapping(droppedTaskId, newLineId, newStartDate, newEndDate);
        
        const startPixel = getPixelOffsetForDate(newStartDate, newLineId);
        const endPixel = getPixelOffsetForDate(newEndDate, newLineId);
        
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

        const { id: droppedTaskId, durationMs, taskOffsetLeft } = JSON.parse(e.dataTransfer.getData('text/plain'));

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

        const totalWorkMinutes = workHours * 60;
        const cellRect = targetCell.getBoundingClientRect();
        const ghostStartX = e.clientX - taskOffsetLeft;
        const dropX = ghostStartX - cellRect.left; 
        const percentOffset = Math.max(0, Math.min(1, dropX / DAY_COLUMN_WIDTH));
        let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);

        const newStartDate = new Date(`${dateStr}T00:00:00`);
        newStartDate.setHours(START_HOUR);
        newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);

        // Simple End Date Calculation
        const newEndDate = new Date(newStartDate.getTime() + durationMs);

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
        const calendarMonths = document.getElementById('calendar-months');
        if (calendarMonths) calendarMonths.innerHTML = '';

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

        // Render Months (NEW)
        if (calendarMonths) {
            let currentMonthLabel = '';
            let currentMonthSpan = 0;
            let currentMonthStartIndex = 0;

            calendarDays.forEach((day, index) => {
                const monthLabel = formatDate(day.date, 'MMM YYYY');
                
                if (monthLabel !== currentMonthLabel) {
                    if (currentMonthLabel) {
                        // Render previous month block
                        const monthEl = document.createElement('div');
                        monthEl.className = 'flex-shrink-0 flex items-center justify-center border-r border-gray-200 bg-gray-50 text-gray-600 font-bold text-sm uppercase tracking-wider';
                        monthEl.style.width = `${currentMonthSpan * DAY_COLUMN_WIDTH}px`;
                        monthEl.innerText = currentMonthLabel;
                        calendarMonths.appendChild(monthEl);
                    }
                    currentMonthLabel = monthLabel;
                    currentMonthSpan = 0;
                    currentMonthStartIndex = index;
                }
                currentMonthSpan++;

                // If last day, render current block
                if (index === calendarDays.length - 1) {
                    const monthEl = document.createElement('div');
                    monthEl.className = 'flex-shrink-0 flex items-center justify-center border-r border-gray-200 bg-gray-50 text-gray-600 font-bold text-sm uppercase tracking-wider';
                    monthEl.style.width = `${currentMonthSpan * DAY_COLUMN_WIDTH}px`;
                    monthEl.innerText = currentMonthLabel;
                    calendarMonths.appendChild(monthEl);
                }
            });
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
                <div class="flex items-baseline space-x-1">
                    <span class="text-xl font-bold ${day.isToday ? 'text-blue-900' : 'text-gray-900'}">
                        ${day.date.getDate()}
                    </span>
                    <span class="font-semibold text-xs uppercase ${day.isToday ? 'text-blue-700' : 'text-gray-500'}">
                        ${formatDate(day.date, 'ddd')}
                    </span>
                </div>
                <!-- Optional: blocked status small text or icon? -->
                ${day.isBlocked ? `<div class="text-[10px] uppercase font-bold text-red-400 leading-none mt-1">${day.isHoliday ? 'Holiday' : 'Weekend'}</div>` : ''}
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

                    cell.className = `grid-cell absolute border-r border-b border-gray-200 ${bgClass} flex items-end justify-center`;
                    cell.style.left = `${dayIndex * DAY_COLUMN_WIDTH}px`;
                    cell.style.top = `${lineIndex * ROW_HEIGHT}px`;
                    cell.style.width = `${DAY_COLUMN_WIDTH}px`;
                    cell.style.height = `${ROW_HEIGHT}px`;
                    cell.style.setProperty('--grid-lines-faint', gridLinesFaint);
                    cell.style.setProperty('--grid-lines-strong', gridLinesStrong);
                    cell.dataset.lineId = line.id;
                    cell.dataset.date = formatDate(day.date, 'YYYY-MM-DD');
                    cell.dataset.isBlocked = day.isBlocked;
                    
                    // Add Label (CENTERED)
                    if (!day.isBlocked && workHours > 0) {
                        const label = document.createElement('div');
                        // Changed: inset-0, flex centered, opacity for subtle look
                        label.className = "absolute inset-0 w-full flex items-center justify-center text-xs text-blue-800 pointer-events-none select-none opacity-25 font-bold tracking-widest";
                        label.innerText = `${workHours}H`;
                        cell.appendChild(label);
                    }

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
        </div>

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

    <!-- Calendar Header (Dates) -->
    <div id="calendar-header" class="sticky-header flex-shrink-0 bg-white shadow z-10 h-24 overflow-hidden">
        <div class="flex flex-col h-full w-max">
            <!-- Row 2: Months -->
            <div id="calendar-months" class="flex h-12 border-b border-gray-200">
                <!-- JS Injected -->
            </div>
            <!-- Row 3: Dates -->
            <div id="calendar-dates" class="flex h-12">
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
            // Sync header scroll X if needed, but header seems to rely on body scroll? 
            // Actually usually header needs to sync X with body. 
            // Let's assume X sync is handled or standard behavior for now, focus on Y for sidebar.
            const header = document.getElementById('calendar-header');
            if(header) header.scrollLeft = e.target.scrollLeft;
        }}
    >
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
