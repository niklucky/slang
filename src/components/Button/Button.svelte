<script lang="ts">
	export let title: string = 'Button';
	export let onClick = () => {};
</script>

<button
	type="button"
	class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
	on:click={onClick}
>
	<!-- Heroicon name: mini/pencil -->
	<svg
		class="-ml-1 mr-2 h-5 w-5 text-gray-500"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 20 20"
		fill="currentColor"
		aria-hidden="true"
	>
		<path
			d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"
		/>
	</svg>
	{title}
	<slot />
</button>
