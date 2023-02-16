<script lang="ts">
	import type { Channel, Key, Namespace } from '@prisma/client';
	import { onMount } from 'svelte';
	import { fetchProjectKeys, type ProjectExtended } from '../../stores/projects';

	import Drawer from '../Drawer/Drawer.svelte';
	import Table from '../Table/Table.svelte';
	import type { Field } from '../Table/types';
	import KeyColumn from './KeyColumn.svelte';
	import KeyForm from './KeyForm.svelte';
	import NamespacesColumn from './NamespacesColumn.svelte';
	import TranslationComponent from './TranslationComponent.svelte';

	export let project: ProjectExtended;
	export let isAddKey = false;
	export let onCloseAddTranslation: () => void;

	let keys: (Key & { namespaces: Namespace[] })[] = [];
	let selectedKey: Key | undefined = undefined;

	let fields: Field<Channel[]>[] = [];
	let baseFields: Field<Channel[]>[] = [
		{
			key: 'name',
			title: 'key',
			component: KeyColumn
		},
		{
			key: 'namespaces',
			component: NamespacesColumn
		}
	];

	$: {
		fields = updateFields();
	}

	function updateFields() {
		const locales = project.locales.map((locale) => {
			return {
				key: locale.id,
				title: locale.title,
				component: TranslationComponent,
				data: project.channels
			};
		});

		return [...baseFields, ...locales];
	}

	function handleRowClick(key: Key) {
		selectedKey = key;
	}

	function handleCloseEditTranslation() {
		selectedKey = undefined;
		onCloseAddTranslation();
	}

	function handleCreate(key: Key) {
		handleCloseEditTranslation();
		load();
	}
	function handleUpdate(key: Key) {
		handleCloseEditTranslation();
		load();
	}

	async function load() {
		const response = await fetchProjectKeys(project!.id);
		keys = response.data;
		fields = updateFields();
	}
	onMount(() => {
		load();
	});
</script>

{#if selectedKey || isAddKey}
	<Drawer
		width={600}
		title={selectedKey ? selectedKey.name : 'Add'}
		isOpened={true}
		onClose={handleCloseEditTranslation}
	>
		<KeyForm {project} key={selectedKey} onCreate={handleCreate} onUpdate={handleUpdate} />
	</Drawer>
{/if}
<Table onRowClick={handleRowClick} data={keys} {fields} />
