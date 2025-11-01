<script>
    import { planningStore } from '../stores/planningStore.js';
    import { CONFIG } from '../utils/constants.js';

    $: lines = $planningStore.lines;

    let datePickerValue = '';

    function goToDate() {
        if (datePickerValue) {
            const newDate = new Date(datePickerValue + 'T00:00:00');
            newDate.setHours(0, 0, 0, 0);
            planningStore.setToday(newDate);
            planningStore.setLoading(true);
            setTimeout(() => planningStore.setLoading(false), 50);
        }
    }

    function goToToday() {
        const newToday = new Date();
        newToday.setHours(0, 0, 0, 0);
        planningStore.setToday(newToday);
        datePickerValue = '';
        planningStore.setLoading(true);
        setTimeout(() => planningStore.setLoading(false), 50);
    }
</script>

<div class="sticky left-0 z-20 flex-shrink-0 bg-white shadow-lg">
    <div class="h-auto md:h-24 border-b border-gray-200 flex flex-col justify-center p-4 sticky top-0 bg-white">
        <h2 class="text-lg font-bold text-gray-700 text-center">Lines</h2>
        
        <div class="mt-2 space-y-2">
            <div class="flex space-x-2">
                <input 
                    type="date" 
                    bind:value={datePickerValue}
                    class="text-xs p-1 border rounded w-full"
                >
                <button 
                    on:click={goToDate}
                    class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                >
                    Go
                </button>
            </div>
            <button 
                on:click={goToToday}
                class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 w-full px-2 py-1 rounded"
            >
                Go to Today
            </button>
        </div>
    </div>
    
    <div class="divide-y divide-gray-200">
        {#each lines as line}
            <div 
                class="flex items-center p-4 border-b border-gray-200"
                style="height: {CONFIG.ROW_HEIGHT}px"
            >
                {line.name}
            </div>
        {/each}
    </div>
</div>