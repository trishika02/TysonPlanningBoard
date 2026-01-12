<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>



<div class="">

	<div class="flex justify-between items-center  mb-4 ">
		<h1 class="text-2xl font-bold">AltarSense</h1>
		<button class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">Login</button>
	</div>
	<div class="flex justify-between items-center  ">
		<button class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">Save</button>
		<button class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">Export</button>
	</div>
	
	<div class="">
		
		{@render children()}
	</div>
	
</div>