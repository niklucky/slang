<script lang="ts">
	import { page } from '$app/stores';
	import type { Locale } from '@prisma/client';
	import { onMount } from 'svelte';
	import Button from '../../../components/Button/Button.svelte';
	import Input from '../../../components/Form/Input.svelte';
	import type { TOption } from '../../../components/Form/types';
	import LocalesFilter from '../../../components/Locales/LocalesFilter.svelte';
	import Modal from '../../../components/Modal/Modal.svelte';
	import NamespacesFilter from '../../../components/Namespaces/NamespacesFilter.svelte';
	import ProjectForm from '../../../components/Projects/ProjectForm.svelte';
	import Title from '../../../components/Title.svelte';
	import TranslationsTable from '../../../components/Translations/TranslationsTable.svelte';
	import { t } from '../../../library/i18n';
	import { fetchProject, type ProjectExtended } from '../../../stores/projects';

	let title = 'Project loading...';

	const projectId = parseInt($page.params.projectId);

	let project: ProjectExtended;

	let isEditModal = false;
	let isAddKey = false;
	let selectedNamespaces: TOption[] = [];
	let selectedLocales: Locale[] = [];
	let searchString: string = '';
	let searchTimer: NodeJS.Timeout | null = null;

	onMount(() => {
		async function load() {
			const response = await fetchProject(projectId);
			project = response.data;
			title = project.name;
			selectedNamespaces = project.namespaces;
			selectedLocales = project.locales;
		}
		load();
	});

	function handleCloseEditModal() {
		isEditModal = false;
	}
	function handleCloseAddTranslationModal() {
		isAddKey = false;
	}

	function handleSelectNamespace(selected: TOption[]) {
		selectedNamespaces = selected;
	}
	function handleSelectLocales(selected: Locale[]) {
		selectedLocales = selected;
	}
	function handleSearch(str: string) {
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = setTimeout(() => {
			searchString = str;
			searchTimer = null;
		}, 500);
	}

	$: toolbar = [
		{
			component: Input,
			props: {
				value: searchString,
				onChange: handleSearch
			}
		},
		{
			component: NamespacesFilter,
			props: {
				namespaces: project?.namespaces,
				onSelect: handleSelectNamespace
			}
		},
		{
			component: LocalesFilter,
			props: {
				locales: project?.locales,
				onSelect: handleSelectLocales
			}
		},
		{
			component: Button,
			props: {
				icon: 'lang',
				title: $t('a_add_translation'),
				onClick: () => {
					isAddKey = true;
				}
			}
		}
	];
	function handleEdit() {
		isEditModal = true;
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#if isEditModal}
	<Modal {title} width={800} isOpened={isEditModal} onClose={handleCloseEditModal}
		><ProjectForm {project} /></Modal
	>
{/if}
{#if project != undefined}
	<Title {toolbar} isEditable={true} onClick={handleEdit}>
		{title}
	</Title>

	<TranslationsTable
		{selectedNamespaces}
		{selectedLocales}
		{searchString}
		{project}
		{isAddKey}
		onCloseAddTranslation={handleCloseAddTranslationModal}
	/>
{:else}
	<p>Loading...</p>
{/if}
