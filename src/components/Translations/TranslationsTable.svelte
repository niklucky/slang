<script lang="ts">
	import type { Channel, Locale, Namespace, Word } from '@prisma/client';
	import { format, parseISO } from 'date-fns';
	import { onMount } from 'svelte';
	import {
		fetchProjectKeys,
		type ProjectExtended,
		type ProjectKeysInput
	} from '../../data/api/projects';
	import { getFlagEmoji } from '../../library/flags';
	import { t } from '../../stores/i18n';

	import DataTable from '../DataTable/DataTable.svelte';
	import type { Field } from '../DataTable/types';
	import Drawer from '../Drawer/Drawer.svelte';
	import type { TOption } from '../Form/types';
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

	let keys: (Word & { namespaces: Namespace[] })[] = [];
	let selectedKey: Word | undefined = undefined;

	let fields: Field<Channel[]>[] = [];
	let baseFields: Field<Channel[]>[] = [
		{
			key: 'id',
			title: $t('id')
		},
		{
			key: 'key',
			title: $t('key'),
			component: KeyColumn
		}
	];

	if (project.namespaces.length) {
		baseFields.push({
			key: 'namespaces',
			title: $t('namespaces'),
			component: NamespacesColumn
		});
	}

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
			{ key: 'updatedAt', title: $t('updatedAt'), render: formatDate }
		];
	}

	function handleRowClick(key: Word) {
		selectedKey = key;
	}

	function handleCloseEditTranslation() {
		selectedKey = undefined;
		onCloseAddTranslation();
	}

	function handleCreate(key: Word) {
		handleCloseEditTranslation();
		load();
	}
	function handleUpdate(key: Word) {
		handleCloseEditTranslation();
		load();
	}
	function handleDelete(key: Word) {
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
		if (project.locales.length === params.locales?.length) {
			delete params.locales;
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
		title={selectedKey ? selectedKey.key : $t('add_translation')}
		isOpened={true}
		onClose={handleCloseEditTranslation}
	>
		<KeyForm
			{project}
			word={selectedKey}
			onCreate={handleCreate}
			onUpdate={handleUpdate}
			onDelete={handleDelete}
		/>
	</Drawer>
{/if}
<DataTable onRowClick={handleRowClick} data={keys} {fields} />
