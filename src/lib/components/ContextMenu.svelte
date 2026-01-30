<script>
    import { onMount, tick } from 'svelte';

    let {
        visible = $bindable(false),
        x = 0,
        y = 0,
        menuItems = [],
        onItemClick = () => {},
        onClose = () => {}
    } = $props();

    let menuElement = $state(null);
    let adjustedX = $state(x);
    let adjustedY = $state(y);

    // When opening or when x/y change, position menu at cursor/task immediately
    $effect(() => {
        if (visible) {
            adjustedX = x;
            adjustedY = y;
        }
    });

    // After render, adjust position to keep menu on screen
    $effect(() => {
        if (visible && menuElement) {
            tick().then(() => {
                const menuRect = menuElement.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                // Adjust horizontal position
                if (adjustedX + menuRect.width > windowWidth) {
                    adjustedX = windowWidth - menuRect.width - 10;
                } else if (adjustedX < 10) {
                    adjustedX = 10;
                }

                // Adjust vertical position
                if (adjustedY + menuRect.height > windowHeight) {
                    adjustedY = windowHeight - menuRect.height - 10;
                } else if (adjustedY < 10) {
                    adjustedY = 10;
                }
            });
        }
    });

    // Close on ESC key
    function handleKeydown(e) {
        if (e.key === 'Escape' && visible) {
            onClose();
        }
    }

    // Close on outside click
    function handleOutsideClick(e) {
        if (visible && menuElement && !menuElement.contains(e.target)) {
            onClose();
        }
    }

    onMount(() => {
        document.addEventListener('keydown', handleKeydown);
        document.addEventListener('mousedown', handleOutsideClick);

        return () => {
            document.removeEventListener('keydown', handleKeydown);
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    });

    function handleItemClick(item) {
        onItemClick(item);
        onClose();
    }
</script>

{#if visible}
    <div
        bind:this={menuElement}
        class="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[180px]"
        style="left: {adjustedX}px; top: {adjustedY}px;"
    >
        <ul class="py-1">
            {#each menuItems as item}
                <li>
                    <button
                        class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                        onclick={() => handleItemClick(item)}
                    >
                        {#if item.icon}
                            <span class="text-lg">{item.icon}</span>
                        {/if}
                        <span>{item.label}</span>
                    </button>
                </li>
            {/each}
        </ul>
    </div>
{/if}

<style>
    /* Ensure context menu appears above everything */
    div {
        pointer-events: auto;
    }
</style>
