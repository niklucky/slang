<script lang="ts">
	import Close from './Icons/Close.svelte';
	import Edit from './Icons/Edit.svelte';
	import Edit2 from './Icons/Edit2.svelte';
	import Globe from './Icons/Globe.svelte';
	import Lang from './Icons/Lang.svelte';
	import Layers from './Icons/Layers.svelte';
	import Plus from './Icons/Plus.svelte';
	import Save from './Icons/Save.svelte';
	import Share from './Icons/Share.svelte';
	import type { IconName } from './Icons/types';

	export let onClick: (() => void) | undefined = undefined;
	export let name: IconName;
	export let size: number = 20;

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
		<Close {size} />
	{/if}
	{#if name === 'edit'} <Edit {size} /> {/if}
	{#if name === 'edit2'} <Edit2 {size} /> {/if}
	{#if name === 'globe'}
		<Globe {size} />
	{/if}

	{#if name === 'lang'} <Lang {size} /> {/if}

	{#if name === 'layers'}
		<Layers {size} />
	{/if}
	{#if name === 'plus'}
		<Plus {size} />
	{/if}
	{#if name === 'save'}
		<Save {size} />
	{/if}
	{#if name === 'share'}
		<Share {size} />
	{/if}
</span>
