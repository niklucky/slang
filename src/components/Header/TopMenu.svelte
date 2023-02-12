<script lang="ts">
	import { page } from '$app/stores';

	let segments = $page.url.pathname.split('/');
	let selected = segments.length > 1 ? segments[1] : null;

	const items = [
		{ url: '', name: 'Dashboard', className: '' },
		{ url: 'projects', name: 'Projects', className: '' }
	];
	function prepareMenu() {
		return items.map((item) => {
			if (item.url === selected) {
				item.className = 'border-b-2 border-b-blue-400';
			} else {
				item.className = 'hover:border-b-2 hover:border-b-blue-400 ';
			}
			return item;
		});
	}
	let menu = prepareMenu();

	function handleClick(item: { url: string }) {
		selected = item.url;
		menu = prepareMenu();
	}
</script>

<div class="hidden sm:ml-6 sm:block">
	<div class="flex space-x-4">
		{#each menu as item}
			<a
				href={`/${item.url}`}
				on:click={() => handleClick(item)}
				class="text-sm font-medium px-3 py-4 {item.className}">{item.name}</a
			>
		{/each}
	</div>
</div>
