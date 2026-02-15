
<script>
    import { tooltipStore } from '$lib/stores/tooltipStore.svelte.js';

    let { 
        task, 
        style, 
        onDragStart, 
        onDragEnd, 
        onContextMenu, 
        formatDate,
        onClick = null,
        isMergeCandidate = false,
        isDimmed = false 
    } = $props();

    function handleDragStart(e) {
        if (isDimmed) {
            e.preventDefault();
            return;
        }
        tooltipStore.hide();
        // Invoke parent handler to set up dataTransfer
        onDragStart(e);
        
        // Visual feedback
        setTimeout(() => {
             e.target.classList.add('dragging');
        }, 0);
    }
    
    function handleClick(e) {
        if (onClick) {
            e.stopPropagation();
            onClick(e, task);
        }
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        onDragEnd(e);
    }


    function handleSegmentEnter(e, segment) {
        e.stopPropagation();
        const content = `
            <strong>Segment:</strong> ${segment.qty} units<br>
            <strong>Progress:</strong> ${Math.round((segment.qty / task.quantity) * 100)}%<br>
            <span class="text-xs text-gray-400">Color: ${segment.color}</span>
        `;
        tooltipStore.show(e.pageX, e.pageY, content);
    }

    function handleRemainingEnter(e) {
        const startStr = formatDate(new Date(task.start), 'YYYY-MM-DD HH:mm');
        const endStr = formatDate(new Date(task.end), 'YYYY-MM-DD HH:mm');
        const remainingQty = task.quantity - (task.completed_quantity || 0);
        const content = `
            <strong>Order:</strong> ${task.orderId}<br>
            <strong>Remaining Qty:</strong> ${remainingQty}<br>
            <strong>Start:</strong> ${startStr}<br>
            <strong>End:</strong> ${endStr}
        `;
        tooltipStore.show(e.pageX, e.pageY, content);
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

    
    function handleContextMenu(e) {
        e.preventDefault(); // Prevent default browser context menu
        e.stopPropagation();
        
        if (onContextMenu) {
            onContextMenu(e, task);
        }
    }

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
    class="task absolute border border-blue-900/10 rounded text-white shadow-sm overflow-hidden cursor-grab active:cursor-grabbing z-10 pointer-events-auto flex items-center justify-center px-2 transition-all duration-300
    {isMergeCandidate ? 'ring-4 ring-green-400 ring-offset-2 z-50 scale-105 cursor-pointer !bg-green-500' : ''} 
    {isDimmed ? 'opacity-20 grayscale pointer-events-none' : ''}"
    style="{style} {getBackgroundStyle()}"
    draggable={!isDimmed && !isMergeCandidate}
    role="button"
    tabindex="0"
    ondragstart={handleDragStart}
    ondragend={handleDragEnd}
    onclick={handleClick}
    onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e);
        }
    }}
    oncontextmenu={handleContextMenu}
    onmouseenter={handleRemainingEnter}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    data-task-id={task.id}
>
    <!-- Background Progress Segments (Full Height) -->
    {#if task.completed_segments && task.completed_segments.length > 0}
        <div class="absolute inset-0 w-full h-full flex overflow-hidden pointer-events-none">
            {#each task.completed_segments as segment}
                <div 
                    class="{segment.color} h-full opacity-90 border-r border-white/10 hover:opacity-100 transition-opacity pointer-events-auto"
                    style="width: {(segment.qty / task.quantity) * 100}%;"
                    onmouseenter={(e) => handleSegmentEnter(e, segment)}
                    onmousemove={handleMouseMove}
                    onmouseleave={handleMouseLeave}
                ></div>
            {/each}
        </div>
    {:else if quantityPercent !== null}
        <!-- Fallback for single segment if no segments defined -->
        <div 
            class="absolute inset-0 h-full bg-green-500/80 hover:bg-green-500 transition-colors pointer-events-auto"
            style="width: {quantityPercent}%;"
            onmouseenter={(e) => handleSegmentEnter(e, { qty: task.completed_quantity, color: 'bg-green-500' })}
            onmousemove={handleMouseMove}
            onmouseleave={handleMouseLeave}
        ></div>
    {/if}

    <!-- Content: Stats Row (Layered on top) -->
    <div class="relative z-10 font-bold text-[11px] leading-tight flex items-center gap-1.5 whitespace-nowrap drop-shadow-lg select-none px-1.5 w-full pointer-events-none">
        <span class="text-white uppercase font-extrabold tracking-tight">{task.style} {task.completed_quantity || 0}/{task.quantity}</span>
        <span class="text-white/30 font-normal">|</span>
        <span class="text-white">{task.total_days}D</span>
        <span class="text-white/30 font-normal">|</span>
        <span class="flex items-center gap-0.5 text-white">
            <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd"></path></svg>
            {quantityPercent ? Math.round(quantityPercent) : 0}%
        </span>
        <span class="text-white/30 font-normal">|</span>
        <span class="text-white">
            {task.total_days - (task.completed_days || 0)}D REM
        </span>
    </div>
</div>

<style>
    :global(.task.dragging) {
        opacity: 0.5;
    }
</style>
