<script>
    import { calendarDays, planningStore } from '../stores/planningStore.js';
    import { CONFIG } from '../utils/constants.js';
    import { formatDate } from '../utils/dateUtils.js';

    function loadMore() {
        planningStore.loadMoreDays();
        planningStore.setLoading(true);
        setTimeout(() => planningStore.setLoading(false), 50);
    }
</script>

<div class="sticky top-0 z-10 flex-shrink-0 bg-white shadow">
    <div class="flex">
        {#each $calendarDays as day}
            <div 
                class="flex-shrink-0 text-center border-l border-b border-gray-200 p-2 
                       {day.isBlocked ? 'bg-gray-200 text-gray-500' : 'bg-white'}
                       {day.isToday ? 'bg-blue-100' : ''}"
                style="width: {CONFIG.DAY_COLUMN_WIDTH}px"
            >
                <div class="font-semibold text-sm {day.isToday ? 'text-blue-700' : 'text-gray-800'}">
                    {formatDate(day.date, 'ddd')}
                </div>
                <div class="text-xl font-bold {day.isToday ? 'text-blue-900' : 'text-gray-900'}">
                    {day.date.getDate()}
                </div>
                <div class="text-xs text-gray-500">
                    {formatDate(day.date, 'MMM YYYY')}
                </div>
                <div class="text-xs font-medium mt-1 {day.isBlocked ? 'text-red-600' : 'text-green-600'}">
                    {#if day.isBlocked}
                        {day.isHoliday ? 'Holiday' : 'Weekend'}
                    {:else}
                        {day.workHours} Hours
                    {/if}
                </div>
            </div>
        {/each}
        
        <div 
            class="flex-shrink-0 text-center border-l border-b border-gray-200 p-2 bg-gray-50 hover:bg-gray-100 cursor-pointer flex flex-col justify-center items-center"
            style="width: 120px"
            on:click={loadMore}
            on:keydown={(e) => e.key === 'Enter' && loadMore()}
            role="button"
            tabindex="0"
        >
            <div class="font-semibold text-sm text-blue-600">Load More</div>
            <div class="text-xs text-gray-500 mt-2">({$planningStore.numDaysToShow} days shown)</div>
        </div>
    </div>
</div>