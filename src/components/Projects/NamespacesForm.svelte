<script lang="ts">
	import type { Namespace } from '@prisma/client';
	import { t } from '../../library/i18n';
	import type { ProjectExtended } from '../../stores/projects';
	import Input from '../Form/Input.svelte';
	import Icon from '../Icon/Icon.svelte';
	import Confirm from '../Modal/Confirm.svelte';
	import H from '../Text/H.svelte';

	export let project: ProjectExtended;
	export let onUpdate: (ns: Namespace) => void;
	export let onDelete: (ns: Namespace) => void;

	let deleteNamespace: Namespace | null = null;

	$: namespaces = project.namespaces;

	function handleAddField() {
		namespaces.push({
			id: 0,
			name: '',
			projectId: project.id
		});
		namespaces = namespaces;
	}
	function handleDeleteConfirm(ns: Namespace) {
		deleteNamespace = ns;
	}
	function handleUpdate(ns: Namespace) {
		return (value: string) => {
			ns.name = value;
			onUpdate(ns);
		};
	}
	function handleDelete() {
		if (deleteNamespace) {
			onDelete(deleteNamespace);
			deleteNamespace = null;
		}
	}
</script>

<Confirm
	isOpened={deleteNamespace !== null}
	title={$t('t_confirm_delete')}
	onCancel={() => (deleteNamespace = null)}
	onOK={handleDelete}
	okText={$t('a_confirm')}
	cancelText={$t('a_cancel')}>{$t('confirm_delete_locale')}</Confirm
>

<div>
	<H size={4}
		><span class="mr-4">{$t('namespaces')}</span><Icon
			name="plus-circle"
			onClick={handleAddField}
		/></H
	>
	{#each namespaces as ns}
		<div class="flex flex-row py-2 items-center">
			<div class="flex-auto mr-4">
				<Input bind:value={ns.name} onBlur={handleUpdate(ns)} />
			</div>
			<div class="w-6">
				{#if ns.id}
					<Icon name="minus-circle" onClick={() => handleDeleteConfirm(ns)} />
				{/if}
			</div>
		</div>
	{/each}
</div>
