
<script>
    import { tooltipStore } from '$lib/stores/tooltipStore.svelte.js';

    let { task, style, onDragStart, onDragEnd, formatDate } = $props();

    function handleDragStart(e) {
        tooltipStore.hide();
        // Invoke parent handler to set up dataTransfer
        onDragStart(e);
        
        // Visual feedback
        setTimeout(() => {
             e.target.classList.add('dragging');
        }, 0);
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        onDragEnd(e);
    }

    function handleMouseEnter(e) {
        const startStr = formatDate(new Date(task.start), 'YYYY-MM-DD HH:mm');
        const endStr = formatDate(new Date(task.end), 'YYYY-MM-DD HH:mm');
        
        const content = `
            <strong>Order:</strong> ${task.orderId}<br>
            <strong>Style:</strong> ${task.style}<br>
            <strong>Qty:</strong> ${task.quantity}<br>
            <strong>Start:</strong> ${startStr}<br>
            <strong>End:</strong> ${endStr}
        `;
        tooltipStore.show(e.pageX, e.pageY, content);
        console.log({
            startStr,
            endStr,
        });
        
    }

    function handleMouseMove(e) {
        tooltipStore.move(e.pageX, e.pageY);
    }

    function handleMouseLeave() {
        tooltipStore.hide();
    }

    // === Visual Logic ===
    
    // 1. Quantity Progress
    let quantityPercent = $derived.by(() => {
        if (task.quantity > 0 && typeof task.completed_quantity === 'number') {
            return Math.min(100, Math.max(0, (task.completed_quantity / task.quantity) * 100));
        }
        return null;
    });

    // 2. Time Progress (Background Gradient)
    function getBackgroundStyle() {
        // Colors
        const COLOR_COMPLETED = '#1d4ed8'; // blue-700
        const COLOR_REMAINING = '#60a5fa'; // blue-400
        
        // Fallback default
        let background = `background-color: ${COLOR_REMAINING};`;

        if (task.total_days > 0 && typeof task.completed_days === 'number') {
            const percent = Math.min(100, Math.max(0, (task.completed_days / task.total_days) * 100));
            // Linear gradient hard stop
            background = `background: linear-gradient(to right, ${COLOR_COMPLETED} 0%, ${COLOR_COMPLETED} ${percent}%, ${COLOR_REMAINING} ${percent}%, ${COLOR_REMAINING} 100%);`;
        }
        
        return background;
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    id="{task.id}-task"
    class="task absolute border border-blue-900/10 rounded text-white shadow-sm overflow-hidden cursor-grab active:cursor-grabbing z-10 pointer-events-auto flex items-center justify-center px-2"
    style="{style} {getBackgroundStyle()}"
    draggable="true"
    ondragstart={handleDragStart}
    ondragend={handleDragEnd}
    onmouseenter={handleMouseEnter}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    data-task-id={task.id}
>
    <!-- Content: Name Only -->
    <div class="font-bold text-[10px] leading-tight truncate drop-shadow-md select-none">
        {task.style}
    </div>
    
    <!-- Quantity Progress (Bottom Strip) -->
    {#if quantityPercent !== null}
        <div 
            class="absolute bottom-0 left-0 h-[50%] bg-green-400/50"
            style="width: {quantityPercent}%;"
        ></div>
    {/if}
</div>

<style>
    :global(.task.dragging) {
        opacity: 0.5;
    }
</style>
