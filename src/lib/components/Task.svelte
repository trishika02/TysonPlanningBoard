
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
    }

    function handleMouseMove(e) {
        tooltipStore.move(e.pageX, e.pageY);
    }

    function handleMouseLeave() {
        tooltipStore.hide();
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    id="{task.id}-task"
    class="task absolute bg-blue-600 border border-blue-800 rounded-lg p-2 text-white shadow-md overflow-hidden cursor-grab active:cursor-grabbing z-10 pointer-events-auto"
    style="{style}"
    draggable="true"
    ondragstart={handleDragStart}
    ondragend={handleDragEnd}
    onmouseenter={handleMouseEnter}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    data-task-id={task.id}
>
    <div class="font-bold text-sm truncate">{task.orderId}</div>
    <div class="text-xs truncate">{task.style}</div>
    <div class="text-xs truncate">Qty: {task.quantity}</div>
</div>

<style>
    .task.dragging {
        opacity: 0.5;
    }
</style>
