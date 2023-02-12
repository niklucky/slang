<script lang="ts">
	import Button from '../Button/Button.svelte';

	export let title: string | undefined = undefined;
	export let isBackdrop = false;
	export let isOpened = false;
	export let width = 400;
	export let onClose: (() => void) | undefined = undefined;

	const style = `width: ${width}px`;

	function handleClose() {
		if (onClose) {
			onClose();
			return;
		}
		isOpened = false;
	}
</script>

{#if isOpened}
	{#if isBackdrop}
		<div class="fixed bg-black w-full h-full top-0 left-0 opacity-30" />
	{/if}
	<div class="fixed w-full h-full top-0 left-0 flex overflow-auto justify-end justify-items-end">
		<div class="bg-white h-full shadow-xl" {style}>
			{#if title}
				<div class="px-6 py-4 mb-0 border-b border-b-gray-200">
					<h2 class="text-xl">{title}</h2>
				</div>
			{/if}
			<div class="py-8 px-8 pt-4 ">
				<slot />
			</div>
			<div class="flex justify-center py-4">
				<Button title="Close" onClick={handleClose} />
			</div>
		</div>
	</div>
{/if}
