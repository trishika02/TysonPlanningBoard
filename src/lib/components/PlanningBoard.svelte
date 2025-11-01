<script>
    import { onMount } from 'svelte';
    import { planningStore } from '../stores/planningStore.js';
    import Sidebar from './Sidebar.svelte';
    import CalendarHeader from './CalendarHeader.svelte';
    import CalendarGrid from './CalendarGrid.svelte';
    import GhostTask from './GhostTask.svelte';
    import Tooltip from './Tooltip.svelte';
    import LoadingModal from './LoadingModal.svelte';

    export let initialLines = [];
    export let initialTasks = [];
    export let initialHolidays = [];

    onMount(() => {
        planningStore.setData(initialLines, initialTasks, initialHolidays);
    });
</script>

<div class="flex h-screen w-full bg-gray-100">
    <Sidebar />
    
    <div class="flex-1 flex flex-col">
        <CalendarHeader />
        <CalendarGrid />
    </div>
</div>

<GhostTask />
<Tooltip />
<LoadingModal />