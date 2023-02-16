<script lang="ts">
	import { page } from '$app/stores';
	import { t } from '../../library/i18n';

	let segments = $page.url.pathname.split('/');
	let selected = segments.length > 1 ? segments[1] : null;

	let menuDashboard = $t('menu_dashboard');

	let items = [
		{ url: '', name: 'menu_dashboard', className: '' },
		{ url: 'projects', name: 'menu_projects', className: '' }
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
	$: names = items.map((item) => $t(item.name));
</script>

<div class="hidden sm:ml-6 sm:block">
	<div class="flex space-x-4">
		{#each menu as item, i}
			<a
				href={`/${item.url}`}
				on:click={() => handleClick(item)}
				class="text-sm font-medium px-3 py-4 {item.className}">{names[i]}</a
			>
		{/each}
	</div>
</div>
