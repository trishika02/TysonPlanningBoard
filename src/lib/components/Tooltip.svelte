
<script>
    import { tooltipStore } from '$lib/stores/tooltipStore.svelte.js';

    let { visible, x, y, content } = $derived(tooltipStore.state);
</script>

{#if visible}
    <div 
        id="tooltip" 
        class="fixed z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm pointer-events-none"
        style="left: {x + 10}px; top: {y + 10}px;" 
        role="tooltip"
    >
        {@html content}
    </div>
{/if}
