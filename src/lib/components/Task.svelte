<script>
    import { planningStore, calendarDays } from '../stores/planningStore.js';
    import { dragStore } from '../stores/dragStore.js';
    import { CONFIG } from '../utils/constants.js';
    import { formatDate } from '../utils/dateUtils.js';
    import { getPixelOffsetForDate, calculateTaskDuration } from '../utils/taskUtils.js';

    export let task;

    $: lines = $planningStore.lines;
    $: days = $calendarDays;
    
    $: taskStart = new Date(task.start);
    $: taskEnd = new Date(task.end);
    $: lineIndex = lines.findIndex(l => l.id === task.lineId);
    
    $: startPixel = getPixelOffsetForDate(taskStart, days);
    $: endPixel = getPixelOffsetForDate(taskEnd, days);
    $: width = endPixel && startPixel ? endPixel - startPixel : 0;
    
    $: visible = lineIndex !== -1 && startPixel !== null && width > 0;
    $: isDragging = $dragStore.draggedTaskId === task.id;

    function handleDragStart(e) {
        const taskRect = e.currentTarget.getBoundingClientRect();
        const taskOffsetLeft = e.clientX - taskRect.left;
        const duration = calculateTaskDuration(taskStart, taskEnd, days);
        
        dragStore.startDrag(task.id, task.lineId, duration, taskOffsetLeft);
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            id: task.id,
            durationMinutes: duration,
            taskOffsetLeft
        }));
        
        setTimeout(() => {
            e.target.classList.add('dragging');
        }, 0);
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        dragStore.endDrag();
    }
</script>

{#if visible}
    <div
        id="{task.id}-task"
        data-task-id={task.id}
        class="task absolute bg-blue-600 border border-blue-800 rounded-lg p-2 text-white shadow-md overflow-hidden cursor-grab active:cursor-grabbing"
        class:dragging={isDragging}
        style="left: {startPixel}px; 
               top: {(lineIndex * CONFIG.ROW_HEIGHT) + 10}px; 
               width: {width}px; 
               height: {CONFIG.ROW_HEIGHT - 20}px;"
        draggable="true"
        on:dragstart={handleDragStart}
        on:dragend={handleDragEnd}
        data-tooltip-content="<strong>Order:</strong> {task.orderId}<br><strong>Style:</strong> {task.style}<br><strong>Qty:</strong> {task.quantity}<br><strong>Start:</strong> {formatDate(taskStart, 'YYYY-MM-DD HH:mm')}<br><strong>End:</strong> {formatDate(taskEnd, 'YYYY-MM-DD HH:mm')}"
        role="button"
        tabindex="0"
    >
        <div class="font-bold text-sm truncate">{task.orderId}</div>
        <div class="text-xs truncate">{task.style}</div>
        <div class="text-xs truncate">Qty: {task.quantity}</div>
    </div>
{/if}

<style>
    .dragging {
        opacity: 0.5;
        pointer-events: none;
    }
</style>