<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Icon from '../Icon/Icon.svelte';

	export let title: string | undefined = undefined;
	export let isOpened = false;
	export let width = 400;
	export let onClose: (() => void) | undefined = undefined;

	$: style = `width: ${width}px`;

	function handleClose() {
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
	$: isShow = isOpened;
</script>

{#if isShow}
	<div class="z-10 fixed bg-black w-full h-full top-0 left-0 opacity-30" transition:fade />
	<div class="fixed w-full h-full top-0 left-0 flex overflow-auto z-20">
		<div class="absolute z-50 w-full h-full" on:keydown={handleClose} on:click={handleClose} />
		<div
			class="bg-white/90 rounded-xl m-auto backdrop-blur relative z-50 "
			{style}
			transition:fly={{ y: 1000, duration: 300, opacity: 1 }}
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
	</div>
{/if}
