<script lang="ts">
	import Close from './Icons/Close.svelte';
	import Edit from './Icons/Edit.svelte';
	import Globe from './Icons/Globe.svelte';
	import Save from './Icons/Save.svelte';
	import type { IconName } from './Icons/types';

	export let onClick: (() => void) | undefined = undefined;
	export let name: IconName;

	function handleClick() {
		onClick && onClick();
	}
</script>

<span
	on:click={handleClick}
	class={onClick ? 'text-gray-500 cursor-pointer' : 'text-gray-500'}
	on:keydown={handleClick}
>
	{#if name === 'close'}
		<Close />
	{/if}
	{#if name === 'save'}
		<Save />
	{/if}
	{#if name === 'edit'}
		<Edit />
	{/if}
	{#if name === 'globe'}
		<Globe />
	{/if}
</span>
