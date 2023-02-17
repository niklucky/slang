<script lang="ts">
	import { t } from '../../library/i18n';
	import Icon from '../Icon/Icon.svelte';
	import type { IconName } from '../Icon/Icons/types';

	export let title: string = '';
	export let onClick = () => {};
	export let icon: IconName | undefined = undefined;

	$: btnTitle = title ? $t(title) : '';
</script>

<button
	type="button"
	class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
	on:click={onClick}
>
	{#if icon}
		<span class={btnTitle ? 'mr-2' : ''}>
			<Icon name={icon} />
		</span>
	{/if}
	{#if btnTitle != ''}
		{btnTitle}
	{/if}
	<slot />
</button>
