<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Icon from '../Icon/Icon.svelte';

	export let title: string | undefined = undefined;
	export let isBackdrop = true;
	export let isOpened = false;
	export let width = 400;
	export let onClose: (() => void) | undefined = undefined;

	const style = `width: ${width}px`;

	const duration = isOpened ? 200 : 200;

	function handleClose(e?: any) {
		if (onClose) {
			onClose();
			return;
		}
		isOpened = false;
	}
	function handleDismiss(e: KeyboardEvent) {
		if (e.code === 'Escape') {
			handleClose();
		}
	}
	onMount(() => {
		window.addEventListener('keydown', handleDismiss);

		return () => window.removeEventListener('keydown', handleDismiss);
	});
</script>

{#if isOpened}
	{#if isBackdrop}
		<div
			class="fixed bg-black w-full h-full top-0 left-0 opacity-30"
			on:keydown={handleClose}
			on:click={handleClose}
			transition:fade
		/>
	{/if}
	<div
		class="bg-white/90 backdrop-blur fixed right-0 h-full top-0 overflow-auto"
		transition:fly={{ x: width, duration: 500, opacity: 1 }}
		{style}
	>
		<div class="absolute right-3 top-3"><Icon name="close" onClick={handleClose} /></div>
		{#if title}
			<div class="px-6 py-4 mb-0 border-b border-b-gray-200">
				<h2 class="text-xl">{title}</h2>
			</div>
		{/if}
		<div class="py-8 px-8 pt-4 ">
			<slot />
		</div>
		<!-- <div class="flex justify-center py-4">
			<Button title="Close" onClick={handleClose} />
		</div> -->
	</div>
{/if}
