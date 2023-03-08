<script lang="ts">
	import type { Channel } from '@prisma/client';
	import type { ProjectExtended } from '../../data/api/projects';
	import { t } from '../../stores/i18n';
	import Input from '../Form/Input.svelte';
	import Icon from '../Icon/Icon.svelte';
	import Confirm from '../Modal/Confirm.svelte';
	import H from '../Text/H.svelte';

	export let project: ProjectExtended;
	export let onUpdate: (ns: Channel) => void;
	export let onDelete: (ns: Channel) => void;

	let itemToDelete: Channel | null = null;

	$: channels = project.channels;
	function handleAddField() {
		channels.push({
			id: 0,
			name: '',
			projectId: project.id,
			deletedAt: null
		});
		channels = channels;
	}

	function handleUpdate(ns: Channel) {
		return (value: string) => {
			ns.name = value;
			onUpdate(ns);
		};
	}

	function handleDeleteConfirm(item: Channel) {
		itemToDelete = item;
	}
	function handleDelete() {
		if (itemToDelete) {
			onDelete(itemToDelete);
			itemToDelete = null;
		}
	}
</script>

<Confirm
	isOpened={itemToDelete !== null}
	title={$t('t_confirm_delete')}
	onCancel={() => (itemToDelete = null)}
	onOK={handleDelete}
	okText={$t('a_confirm')}
	cancelText={$t('a_cancel')}>{$t('confirm_delete_channel')}</Confirm
>

<div>
	<H size={4}
		><span class="mr-4">{$t('channels')}</span><Icon
			name="plus-circle"
			onClick={handleAddField}
		/></H
	>

	{#each channels as channel}
		<div class="flex flex-row py-2 items-center">
			<div class="flex-auto mr-4">
				<Input bind:value={channel.name} onBlur={handleUpdate(channel)} />
			</div>
			<div class="w-6">
				{#if channel.id}
					<Icon name="minus-circle" onClick={() => handleDeleteConfirm(channel)} />
				{/if}
			</div>
		</div>
	{/each}
</div>
