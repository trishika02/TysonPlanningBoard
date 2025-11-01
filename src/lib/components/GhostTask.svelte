<script>
    import { dragStore } from '../stores/dragStore.js';

    $: position = $dragStore.ghostPosition;
    $: isValid = $dragStore.ghostIsValid;
    $: visible = $dragStore.isDragging && position;
</script>

{#if visible}
    <div
        id="ghost-task"
        class="absolute z-50 opacity-70 border-2 border-dashed pointer-events-none rounded-lg p-2 box-border
               {isValid ? 'bg-blue-100 border-blue-500' : 'bg-red-100 border-red-500'}"
        style="left: {position.left}px; 
               top: {position.top}px; 
               width: {position.width}px; 
               height: {position.height}px;"
    ></div>
{/if}