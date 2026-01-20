<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>



<div class="min-h-screen bg-gray-50 flex flex-col items-center">

	<!-- Top Navigation Bar -->
	<nav class="w-[90%] bg-white shadow-sm rounded-b-lg px-6 py-4 mb-6 flex justify-between items-center border border-gray-100">
		<div class="flex items-center space-x-8">
			<h1 class="text-xl font-bold text-gray-800 tracking-tight">AltarSense</h1>
			<div class="flex space-x-2">
				<button class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-50">Planning</button>
				<button class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-50">Reports</button>
			</div>
		</div>
		<div class="flex items-center space-x-3">
			<button class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm">Export</button>
			<button class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-md hover:shadow-lg">Save Changes</button>
			<div class="w-px h-6 bg-gray-200 mx-2"></div>
			<button class="text-gray-500 hover:text-gray-700 text-sm font-medium">Login</button>
		</div>
	</nav>
	
	<!-- Main Application Body -->
	<div class="w-[90%] bg-white rounded-xl shadow-lg border border-gray-200 flex-1 flex flex-col overflow-hidden mb-8 h-[80vh]">
		{@render children()}
	</div>
	
</div>