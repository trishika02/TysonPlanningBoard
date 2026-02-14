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
        class="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden min-w-[200px] py-1 animation-scale-in"
        style="left: {adjustedX}px; top: {adjustedY}px;"
    >
        <ul class="flex flex-col">
            {#each menuItems as item}
                <li class="px-1">
                    <button
                        class="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-3 rounded-md"
                        onclick={() => handleItemClick(item)}
                    >
                        {#if item.icon}
                            <span class="text-base w-5 flex justify-center opacity-70">{item.icon}</span>
                        {/if}
                        <span>{item.label}</span>
                    </button>
                    <!-- Divider logic if needed -->
                    {#if item.divider}
                        <div class="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2"></div>
                    {/if}
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
    .animation-scale-in {
        animation: scaleIn 0.1s ease-out;
        transform-origin: top left;
    }
    @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
</style>
