<script>
    import { planningStore, calendarDays } from '../stores/planningStore.js';
    import { dragStore } from '../stores/dragStore.js';
    import { CONFIG } from '../utils/constants.js';
    import { formatDate } from '../utils/dateUtils.js';
    import { 
        getPixelOffsetForDate, 
        calculateNewEndDate, 
        isOverlapping 
    } from '../utils/taskUtils.js';
    import Task from './Task.svelte';

    $: lines = $planningStore.lines;
    $: tasks = $planningStore.tasks;
    $: days = $calendarDays;

    function getGridLineStyles(day) {
        if (day.workHours === 0) return { faint: 'none', strong: 'none' };
        
        const percentPerHr = 100 / day.workHours;
        return {
            faint: `repeating-linear-gradient(to right, #f0f0f0 0, #f0f0f0 1px, transparent 1px, transparent ${percentPerHr}%)`,
            strong: `repeating-linear-gradient(to right, #a5b4fc 0, #a5b4fc 1px, transparent 1px, transparent ${percentPerHr}%)`
        };
    }

    function handleCellDragOver(e, line, day) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!$dragStore.isDragging) return;
        
        const isBlocked = day.isBlocked;
        const dateStr = formatDate(day.date, 'YYYY-MM-DD');

        if (isBlocked || day.workHours === 0) {
            dragStore.updateGhost(null, false);
            e.dataTransfer.dropEffect = 'none';
            return;
        }

        const { draggedTaskId, draggedTaskDuration, taskOffsetLeft } = $dragStore;
        
        const totalWorkMinutes = day.workHours * 60;
        const cell = e.currentTarget;
        const cellRect = cell.getBoundingClientRect();
        const ghostStartX = e.clientX - taskOffsetLeft;
        const dropX = ghostStartX - cellRect.left;
        const percentOffset = Math.max(0, Math.min(1, dropX / CONFIG.DAY_COLUMN_WIDTH));
        let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);
        
        const newStartDate = new Date(`${dateStr}T00:00:00`);
        newStartDate.setHours(CONFIG.START_HOUR);
        newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);

        const newEndDate = calculateNewEndDate(newStartDate, draggedTaskDuration, days);
        const hasOverlap = isOverlapping(draggedTaskId, line.id, newStartDate, newEndDate, tasks);
        
        const startPixel = getPixelOffsetForDate(newStartDate, days);
        const endPixel = getPixelOffsetForDate(newEndDate, days);
        
        if (startPixel === null || endPixel === null) {
            dragStore.updateGhost(null, false);
            e.dataTransfer.dropEffect = 'none';
            return;
        }

        const newWidth = endPixel - startPixel;
        const lineIndex = lines.findIndex(l => l.id === line.id);
        const newTop = (lineIndex * CONFIG.ROW_HEIGHT) + 10;
        
        dragStore.updateGhost({
            left: startPixel,
            top: newTop,
            width: newWidth,
            height: CONFIG.ROW_HEIGHT - 20
        }, !hasOverlap);

        e.dataTransfer.dropEffect = hasOverlap ? 'none' : 'move';
    }

    function handleCellDrop(e, line, day) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!$dragStore.isDragging) return;
        
        const isBlocked = day.isBlocked;
        const dateStr = formatDate(day.date, 'YYYY-MM-DD');

        if (isBlocked || day.workHours === 0) {
            console.warn("Cannot drop on blocked day");
            return;
        }

        const { draggedTaskId, draggedTaskDuration, taskOffsetLeft } = $dragStore;
        
        const totalWorkMinutes = day.workHours * 60;
        const cell = e.currentTarget;
        const cellRect = cell.getBoundingClientRect();
        const ghostStartX = e.clientX - taskOffsetLeft;
        const dropX = ghostStartX - cellRect.left;
        const percentOffset = Math.max(0, Math.min(1, dropX / CONFIG.DAY_COLUMN_WIDTH));
        let newStartOffsetMinutes = Math.floor(percentOffset * totalWorkMinutes);
        
        const newStartDate = new Date(`${dateStr}T00:00:00`);
        newStartDate.setHours(CONFIG.START_HOUR);
        newStartDate.setMinutes(newStartDate.getMinutes() + newStartOffsetMinutes);

        const newEndDate = calculateNewEndDate(newStartDate, draggedTaskDuration, days);
        
        if (isOverlapping(draggedTaskId, line.id, newStartDate, newEndDate, tasks)) {
            console.warn("DROP REJECTED: Task would overlap");
            return;
        }

        // Force a complete re-render by updating the tasks array immutably
        planningStore.updateTask(draggedTaskId, {
            lineId: line.id,
            start: newStartDate.toISOString(),
            end: newEndDate.toISOString()
        });
        
        console.log(`Task ${draggedTaskId} moved to ${line.id} at ${newStartDate.toISOString()}`);
    }
</script>

<div class="flex-1 overflow-x-auto">
    <div class="relative min-w-max">
        <!-- Grid cells -->
        {#each days as day, dayIndex}
            {#each lines as line, lineIndex}
                {@const gridLines = getGridLineStyles(day)}
                {@const cellId = `cell-${line.id}-${formatDate(day.date, 'YYYY-MM-DD')}`}
                <div
                    id={cellId}
                    class="absolute border-r border-b border-gray-200 grid-cell {day.isBlocked ? 'bg-gray-100' : 'bg-white'}"
                    style="left: {dayIndex * CONFIG.DAY_COLUMN_WIDTH}px; 
                           top: {lineIndex * CONFIG.ROW_HEIGHT}px; 
                           width: {CONFIG.DAY_COLUMN_WIDTH}px; 
                           height: {CONFIG.ROW_HEIGHT}px;
                           --grid-lines-faint: {gridLines.faint};
                           --grid-lines-strong: {gridLines.strong};
                           background-image: var(--grid-lines-faint, none);"
                    data-line-id={line.id}
                    data-date={formatDate(day.date, 'YYYY-MM-DD')}
                    data-is-blocked={day.isBlocked}
                    on:dragover={(e) => handleCellDragOver(e, line, day)}
                    on:drop={(e) => handleCellDrop(e, line, day)}
                    role="gridcell"
                    tabindex="-1"
                ></div>
            {/each}
        {/each}

        <!-- Tasks -->
        {#each tasks as task (task.id)}
            <Task {task} />
        {/each}
    </div>
</div>