<script lang="ts">
	import Icon from '../Icon/Icon.svelte';
	import type { IconName } from '../Icon/Icons/types';

	export let title: string = 'Button';
	export let onClick = () => {};
	export let icon: IconName | undefined = undefined;
</script>

<button
	type="button"
	class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
	on:click={onClick}
>
	<span class="mr-2">
		{#if icon}
			<Icon name={icon} />
		{/if}
	</span>
	{title}
	<slot />
</button>
