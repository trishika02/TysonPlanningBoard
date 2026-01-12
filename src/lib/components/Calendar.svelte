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
    
    // Constants
    let NUM_DAYS_TO_SHOW = 60;
    const DAY_COLUMN_WIDTH = 200;
    const ROW_HEIGHT = 36;
    const FOOTER_HEIGHT = 0; // Removed footer for compactness
    const START_HOUR = 8;
    const END_HOUR = 18;

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
        const dateObj = new Date(date);
        const dateStr = formatDate(dateObj, 'YYYY-MM-DD');
        const dayIndex = calendarDays.findIndex(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
        
        // Not on calendar
        if (dayIndex === -1) return null;

        const day = calendarDays[dayIndex];
        const workHours = getLineWorkHours(day.date, lineId);
        
        // If date is on a blocked day, we can't calculate a time-based offset.
        if (day.isBlocked || workHours === 0) {
            // Snap to the start of the day block
            return dayIndex * DAY_COLUMN_WIDTH;
        }

        const totalWorkMinutes = workHours * 60;
        const dayWorkStart = new Date(day.date);
        dayWorkStart.setHours(START_HOUR, 0, 0, 0);

        const dayWorkEnd = new Date(dayWorkStart.getTime() + totalWorkMinutes * 60000);

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
        const top = (lineIndex * ROW_HEIGHT) + 8; // More padding top
        const height = ROW_HEIGHT - 16; // Leaves 8px padding bottom (approx 20px height)
        
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
        
        draggedTaskDuration = 0; 
        let tempDate = new Date(taskStart);
        tempDate.setHours(0,0,0,0); 
        
        // This duration calc assumes context of the orginal line? 
        // Or absolute duration?
        // Let's calculate absolute work minutes based on original line's schedule.
        
        while(tempDate < taskEnd) {
            const dateStr = formatDate(tempDate, 'YYYY-MM-DD');
            const day = calendarDays.find(d => formatDate(d.date, 'YYYY-MM-DD') === dateStr);
            const workHours = getLineWorkHours(tempDate, originalLineId);

            if (day && !day.isBlocked && workHours > 0) {
                const dayWorkStart = new Date(day.date);
                dayWorkStart.setHours(START_HOUR, 0, 0, 0);
                const dayWorkEnd = new Date(dayWorkStart.getTime() + workHours * 60 * 60000);

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
        
        const { id: droppedTaskId, durationMinutes: workDurationMinutes, taskOffsetLeft } = JSON.parse(data);
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

        const newEndDate = calculateNewEndDate(newStartDate, workDurationMinutes, newLineId);
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

        const { id: droppedTaskId, durationMinutes: workDurationMinutes, taskOffsetLeft } = JSON.parse(e.dataTransfer.getData('text/plain'));

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

        let newEndDate = calculateNewEndDate(newStartDate, workDurationMinutes, newLineId);

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

        // 2. Clear GRID BACKGROUND ONLY
        const gridBackgroundLayer = document.getElementById('grid-background-layer');
        if (gridBackgroundLayer) {
            gridBackgroundLayer.innerHTML = '';
        }
        
        // RE-POPULATE calendarDays
        const tempDays = [];
        const currentDate = new Date(today);
        for (let i = 0; i < NUM_DAYS_TO_SHOW; i++) {
            const date = new Date(currentDate);
            const dayOfWeek = date.getDay();
            const workHours = getStandardWorkHours(dayOfWeek); 
            // NOTE: workHours here is just for "is it weekend?", line specific hours overrides this.
            // But we keep it to know if it's a weekend globally.
            const isWeekend = workHours === 0;
            const isHoliday = holidays.includes(formatDate(date, 'YYYY-MM-DD'));
            const isBlocked = isWeekend || isHoliday;

            tempDays.push({
                date,
                dayOfWeek,
                // workHours, // REMOVE THIS from global day object to avoid confusion
                isBlocked,
                isToday: i === 0
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        calendarDays = tempDays;

        // Render Dates
        calendarDays.forEach((day) => {
            const dateEl = document.createElement('div');
            dateEl.className = `flex-shrink-0 text-center border-l border-b border-gray-200 p-2 ${day.isBlocked ? 'bg-gray-200 text-gray-500' : 'bg-white'} ${day.isToday ? 'bg-blue-100' : ''}`;
            dateEl.style.width = `${DAY_COLUMN_WIDTH}px`;
            // Simplified Header - removing work hours here as requested it's now per cell
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
                <div class="text-xs font-medium mt-1 ${day.isBlocked ? 'text-red-600' : 'hidden'}">
                    ${day.isBlocked ? (day.isHoliday ? 'Holiday' : 'Weekend') : ''}
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
            // We removed loadingModal reference here to avoid errors if not passed
            setTimeout(() => renderBoard(), 50); 
        });
        calendarDates.appendChild(loadMoreButton);

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
    <!-- Calendar Header (Dates) -->
    <div id="calendar-header" class="sticky-header flex-shrink-0 bg-white shadow z-10 h-24 overflow-hidden">
        <!-- Header row for dates -->
        <div id="calendar-dates" class="flex h-full">
            <!-- Date columns will be injected by JS -->
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
