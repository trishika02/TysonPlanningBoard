<script>
    let { lines, rowHeight, onDateChange, onResetDate } = $props();

    let dateValue = $state('');

    function handleDateGo() {
        if (dateValue) {
            onDateChange(dateValue);
        }
    }

    function handleReset() {
        dateValue = '';
        onResetDate();
    }
</script>

<div id="sidebar" class="sticky-sidebar flex-shrink-0 bg-white shadow-lg z-20">
    <!-- Sidebar Header -->
    <div class="sidebar-header h-auto md:h-24 border-b border-gray-200 flex flex-col justify-center p-4 sticky-header bg-white">
        <h2 class="text-lg font-bold text-gray-700 text-center">Lines</h2>
        <!-- Date Navigation -->
        <div class="mt-2 space-y-2">
            <div class="flex space-x-2">
                <input 
                    type="date" 
                    id="date-picker" 
                    class="text-xs p-1 border rounded w-full"
                    bind:value={dateValue}
                >
                <button 
                    id="go-to-date-btn" 
                    class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                    onclick={handleDateGo}
                >
                    Go
                </button>
            </div>
            <button 
                id="go-to-today-btn" 
                class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 w-full px-2 py-1 rounded"
                onclick={handleReset}
            >
                Go to Today
            </button>
        </div>
    </div>
    <!-- Sidebar Body (Line Rows) -->
    <div id="sidebar-rows" class="divide-y divide-gray-200">
        {#each lines as line (line.id)}
            <div 
                class="flex items-center p-4 border-b border-gray-200"
                style="height: {rowHeight}px;"
            >
                {line.name}
            </div>
        {/each}
    </div>
</div>
