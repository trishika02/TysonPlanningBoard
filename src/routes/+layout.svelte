<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
	
	// Create a save function context that child pages can override
	let onSave = $state(() => {
		console.log('Save button clicked - no handler registered');
	});
	
	// Save status state
	let saveStatus = $state(''); // '', 'saving', 'success', 'error'
	let saveMessage = $state('');
	
	function handleSave() {
		onSave();
	}
	
	// Provide the save setter and status to children
	function registerSave(fn) {
		onSave = fn;
	}
	
	function setSaveStatus(status, message) {
		saveStatus = status;
		saveMessage = message;
	}
	
	import { setContext } from 'svelte';
	setContext('registerSave', registerSave);
	setContext('setSaveStatus', setSaveStatus);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col items-center">

	<!-- Top Navigation Bar -->
	<nav class="w-[90%] bg-white shadow-sm rounded-b-lg px-6 py-4 mb-6 flex justify-between items-center border border-gray-100">
		<div class="flex items-center space-x-8">
			<h1 class="text-xl font-bold text-gray-800 tracking-tight">ALTERSENSE</h1>
			<div class="flex space-x-2">
				<button class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-50">Planning</button>
				<button class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-50">Reports</button>
			</div>
		</div>
		<div class="flex items-center space-x-3">
			<button class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm">Export</button>
			<button 
				class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-md hover:shadow-lg"
				onclick={handleSave}
			>
				Save Changes
			</button>
			<div class="w-px h-6 bg-gray-200 mx-2"></div>
			<button class="text-gray-500 hover:text-gray-700 text-sm font-medium">Login</button>
		</div>
	</nav>

	<!-- Save Status Notification -->
	{#if saveStatus}
		<div class="fixed top-20 right-8 z-50 px-6 py-3 rounded-lg shadow-lg transition-all text-white"
		     class:bg-green-500={saveStatus === 'success'}
		     class:bg-red-500={saveStatus === 'error'}
		     class:bg-blue-500={saveStatus === 'saving'}>
			{#if saveStatus === 'saving'}
				<div class="flex items-center gap-2">
					<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018 8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span>{saveMessage}</span>
				</div>
			{:else}
				<div class="flex items-center gap-2">
					{#if saveStatus === 'success'}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
						</svg>
					{:else}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					{/if}
					<span>{saveMessage}</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Main Application Body -->
	<div class="w-[90%] bg-white rounded-xl shadow-lg border border-gray-200 flex-1 flex flex-col overflow-hidden mb-8 h-[80vh]">
		{@render children()}
	</div>

</div>
