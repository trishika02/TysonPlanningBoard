<script>
    import { slide } from 'svelte/transition';

    let {
        visible = $bindable(false),
        task = null,
        onSubmit = () => {},
        onCancel = () => {}
    } = $props();

    let splitQuantity = $state('');
    let errorMessage = $state('');

    // Reset form when modal opens/closes
    $effect(() => {
        if (visible) {
            splitQuantity = '';
            errorMessage = '';
        }
    });

    let remainingQuantity = $derived.by(() => {
        if (!task) return 0;
        return task.quantity - (task.completed_quantity || 0);
    });

    function validateAndSubmit() {
        errorMessage = '';

        const qty = parseInt(splitQuantity, 10);

        if (!splitQuantity || isNaN(qty)) {
            errorMessage = 'Please enter a valid quantity';
            return;
        }

        if (qty <= 0) {
            errorMessage = 'Quantity must be greater than 0';
            return;
        }

        if (qty > remainingQuantity) {
            errorMessage = `Cannot split more than remaining quantity (${remainingQuantity})`;
            return;
        }

        // Submit the split
        onSubmit({ splitQuantity: qty });
        visible = false;
    }

    function handleCancel() {
        onCancel();
        visible = false;
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            handleCancel();
        } else if (e.key === 'Enter') {
            validateAndSubmit();
        }
    }
</script>

{#if visible && task}
    <!-- Modal Backdrop -->
    <div class="fixed inset-0 bg-black bg-opacity-50 z-[9998] flex items-center justify-center" transition:slide>
        <!-- Modal Content -->
        <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="split-task-title"
            tabindex="-1"
            class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-gray-700"
            onkeydown={handleKeydown}
        >
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
                <h2 id="split-task-title" class="text-xl font-bold">Split Task</h2>
                <p class="text-sm text-blue-100 mt-1">Create a new task from existing quantity</p>
            </div>

            <!-- Body -->
            <div class="p-6 space-y-6">
                <!-- Task Information Display -->
                <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                        Original Task Info
                    </h3>
                    
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span class="text-gray-500 dark:text-gray-400">Style:</span>
                            <span class="ml-2 font-medium text-gray-900 dark:text-white">{task.style}</span>
                        </div>
                        <div>
                            <span class="text-gray-500 dark:text-gray-400">Order:</span>
                            <span class="ml-2 font-medium text-gray-900 dark:text-white">{task.orderId}</span>
                        </div>
                        <div>
                            <span class="text-gray-500 dark:text-gray-400">Total Qty:</span>
                            <span class="ml-2 font-bold text-gray-900 dark:text-white">{task.quantity}</span>
                        </div>
                        <div>
                            <span class="text-gray-500 dark:text-gray-400">Completed:</span>
                            <span class="ml-2 font-medium text-green-600 dark:text-green-400">{task.completed_quantity || 0}</span>
                        </div>
                        <div class="col-span-2">
                            <span class="text-gray-500 dark:text-gray-400">Remaining:</span>
                            <span class="ml-2 font-bold text-blue-600 dark:text-blue-400">{remainingQuantity}</span>
                        </div>
                    </div>
                </div>

                <!-- Input Section -->
                <div class="space-y-2">
                    <label for="split-quantity" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Split Quantity
                    </label>
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                        id="split-quantity"
                        type="number"
                        bind:value={splitQuantity}
                        min="1"
                        max={remainingQuantity}
                        placeholder={`Enter quantity (max: ${remainingQuantity})`}
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        autofocus
                    />
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        A new task will be created with this quantity. The original task will be reduced accordingly.
                    </p>
                </div>

                <!-- Error Message -->
                {#if errorMessage}
                    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                        {errorMessage}
                    </div>
                {/if}
            </div>

            <!-- Footer -->
            <div class="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end gap-3">
                <button
                    type="button"
                    onclick={handleCancel}
                    class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onclick={validateAndSubmit}
                    class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                    Split Task
                </button>
            </div>
        </div>
    </div>
{/if}
