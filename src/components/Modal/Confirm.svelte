<script lang="ts">
	import Button from '../Button/Button.svelte';
	import Toolbar from '../Form/Toolbar.svelte';
	import Modal from './Modal.svelte';

	export let isOpened = false;
	export let title: string;
	export let onCancel: () => void;
	export let onOK: () => void;
	export let okText: string = 'OK';
	export let cancelText: string = 'Cancel';
</script>

{#if isOpened}
	<Modal {isOpened} {title} onClose={onCancel}
		><slot />
		<Toolbar>
			<Button onClick={onCancel}>{cancelText}</Button>
			<Button onClick={onOK} mode="primary">{okText}</Button>
		</Toolbar>
	</Modal>
{/if}
