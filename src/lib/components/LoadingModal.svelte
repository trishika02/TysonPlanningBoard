<script>
    import { planningStore } from '../stores/planningStore.js';
</script>

{#if $planningStore.isLoading}
    <div class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-6 rounded-lg shadow-xl">
            <div class="text-lg font-semibold">Loading Planner...</div>
        </div>
    </div>
{/if}