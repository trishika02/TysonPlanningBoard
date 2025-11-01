<script>
    import { onMount } from 'svelte';

    let visible = false;
    let content = '';
    let x = 0;
    let y = 0;

    function showTooltip(e) {
        // Check if target is an element before calling closest
        if (!e.target || typeof e.target.closest !== 'function') return;
        
        const target = e.target.closest('[data-tooltip-content]');
        if (target) {
            content = target.dataset.tooltipContent;
            visible = true;
            updatePosition(e);
        }
    }

    function hideTooltip(e) {
        // Check if we're actually leaving a tooltip element
        if (!e.target || typeof e.target.closest !== 'function') return;
        
        const target = e.target.closest('[data-tooltip-content]');
        if (target) {
            visible = false;
        }
    }

    function updatePosition(e) {
        x = e.pageX + 10;
        y = e.pageY + 10;
    }

    onMount(() => {
        document.addEventListener('mouseenter', showTooltip, true);
        document.addEventListener('mouseleave', hideTooltip, true);
        document.addEventListener('mousemove', (e) => {
            if (visible) updatePosition(e);
        });

        return () => {
            document.removeEventListener('mouseenter', showTooltip, true);
            document.removeEventListener('mouseleave', hideTooltip, true);
        };
    });
</script>

{#if visible}
    <div
        class="fixed z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm"
        style="left: {x}px; top: {y}px;"
        role="tooltip"
    >
        {@html content}
    </div>
{/if}