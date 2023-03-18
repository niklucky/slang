<script lang="ts">
	import Icon from '../Icon/Icon.svelte';
	import type { IconName } from '../Icon/Icons/types';

	export let title: string = '';
	export let onClick = () => {};
	export let icon: IconName | undefined = undefined;
	export let mode: 'default' | 'primary' | 'danger' = 'default';

	const className = [
		'group inline-flex items-center rounded-md border  px-4 py-2 text-sm font-medium  shadow-sm  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
	];
	let iconColor = '';

	if (mode === 'default') {
		className.push('border-gray-300 bg-white text-gray-700 hover:bg-gray-50');
	}
	if (mode === 'danger') {
		className.push('border-red-500 bg-white-500 text-red-500 hover:bg-red-600 hover:text-white');
		iconColor = 'text-red-500 group-hover:text-white';
	}
	if (mode === 'primary') {
		className.push('border-sky-400 bg-sky-400 text-white hover:bg-sky-600');
		iconColor = 'text-sky-400 group-hover:text-white';
	}
</script>

<button type="button" class={className.join(' ')} on:click={onClick}>
	{#if icon}
		<span class={title ? 'mr-2' : ''}>
			<Icon name={icon} color={iconColor} />
		</span>
	{/if}
	{#if title != ''}
		{title}
	{/if}
	<slot />
</button>
