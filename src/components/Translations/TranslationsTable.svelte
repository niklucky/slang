<script lang="ts">
	import type { Channel, Key, Namespace } from '@prisma/client';
	import { onMount } from 'svelte';
	import { fetchProjectKeys, type ProjectExtended } from '../../stores/projects';

	import Drawer from '../Drawer/Drawer.svelte';
	import Table from '../Table/Table.svelte';
	import type { Field } from '../Table/types';
	import KeyColumn from './KeyColumn.svelte';
	import NamespacesColumn from './NamespacesColumn.svelte';
	import TranslationComponent from './TranslationComponent.svelte';
	import TranslationForm from './TranslationForm.svelte';

	export let project: ProjectExtended;
	export let isAddKey = false;

	const projectId = project.id;

	let keys: (Key & { namespaces: Namespace[] })[] = [];
	let selectedKey: Key | undefined = undefined;

	let fields: Field<Channel[]>[] = [];
	let baseFields: Field<Channel[]>[] = [
		{
			key: 'id'
		},
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

	console.log('project', project);

	$: {
		const locales = project.locales.map((locale) => {
			return {
				key: locale.id,
				title: locale.title,
				component: TranslationComponent,
				data: project.channels
			};
		});
		fields = [...baseFields, ...locales];
	}
	function handleRowClick(key: Key) {
		console.log(key);
		selectedKey = key;
	}

	function handleCloseEditTranslation() {
		selectedKey = undefined;
		isAddKey = false;
	}

	function handleCreate(key: Key) {
		handleCloseEditTranslation();
	}
	function handleUpdate(key: Key) {
		handleCloseEditTranslation();
		load();
	}

	async function load() {
		const response = await fetchProjectKeys(project!.id);
		console.log('response.data', response.data);
		keys = response.data;
	}
	onMount(() => {
		load();
	});
</script>

{#if selectedKey || isAddKey}
	<Drawer
		title={selectedKey ? selectedKey.name : 'Add'}
		isOpened={true}
		onClose={handleCloseEditTranslation}
	>
		<TranslationForm
			{projectId}
			key={selectedKey}
			onCreate={handleCreate}
			onUpdate={handleUpdate}
		/>
	</Drawer>
{/if}
<Table onRowClick={handleRowClick} data={keys} {fields} />
