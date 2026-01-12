<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>


<!-- basic nav bar design ueing tailwind -->
<div class="flex justify-between items-center p-4 fixed top-0 left-0 right-0 mb-4 ring">
	<h1 class="text-2xl font-bold">AltarSense</h1>
	<button class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">Login</button>
</div>
<div class="flex justify-between items-center p-4 fixed bottom-0 left-0 right-0 ring">
	<button class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">Save</button>
	<button class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">Export</button>
</div>

<div class="mt-20">

	{@render children()}
</div>
