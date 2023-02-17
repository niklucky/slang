<script lang="ts">
	import type { Channel, Key, Locale, Namespace } from '@prisma/client';
	import { format, parseISO } from 'date-fns';
	import { onMount } from 'svelte';
	import { getFlagEmoji } from '../../library/flags';
	import { t } from '../../library/i18n';
	import {
		fetchProjectKeys,
		type ProjectExtended,
		type ProjectKeysInput
	} from '../../stores/projects';

	import Drawer from '../Drawer/Drawer.svelte';
	import type { TOption } from '../Form/types';
	import Table from '../Table/Table.svelte';
	import type { Field } from '../Table/types';
	import KeyColumn from './KeyColumn.svelte';
	import KeyForm from './KeyForm.svelte';
	import NamespacesColumn from './NamespacesColumn.svelte';
	import TranslationComponent from './TranslationComponent.svelte';

	export let project: ProjectExtended;
	export let isAddKey = false;
	export let onCloseAddTranslation: () => void;
	export let selectedNamespaces: TOption[] = [];
	export let selectedLocales: Locale[] = [];
	export let searchString: string;

	let keys: (Key & { namespaces: Namespace[] })[] = [];
	let selectedKey: Key | undefined = undefined;

	let fields: Field<Channel[]>[] = [];
	let baseFields: Field<Channel[]>[] = [
		{
			key: 'name',
			title: $t('key'),
			component: KeyColumn
		},
		{
			key: 'namespaces',
			title: $t('namespaces'),
			component: NamespacesColumn
		}
	];

	$: {
		load(selectedNamespaces, selectedLocales, searchString);
		fields = updateFields();
	}

	function formatDate(dt: any) {
		return format(parseISO(dt), 'dd.MM.yyyy, HH:mm');
	}

	function updateFields() {
		const locales = selectedLocales.map((locale) => {
			return {
				key: locale.id,
				title: getFlagEmoji(locale.countryCode) + ' ' + locale.title,
				component: TranslationComponent,
				data: project.channels
			};
		});

		return [
			...baseFields,
			...locales,
			{ key: 'createdAt', title: $t('createdAt'), render: formatDate }
		];
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

	async function load(namespaces?: TOption[], locales?: TOption[], search?: string) {
		const params: ProjectKeysInput = {
			projectId: project.id,
			namespaces: namespaces || selectedNamespaces,
			locales: locales || selectedLocales,
			search: search || searchString
		};
		if (project.namespaces.length === params.namespaces?.length) {
			delete params.namespaces;
		}
		const response = await fetchProjectKeys(params);
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
