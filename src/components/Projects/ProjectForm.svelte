<script lang="ts">
	import type { Namespace } from '@prisma/client';
	import { t } from '../../library/i18n';
	import {
		createProject,
		createProjectNamespace,
		deleteProjectNamespace,
		fetchProject,
		updateProject,
		updateProjectNamespace,
		type ProjectExtended
	} from '../../stores/projects';
	import Button from '../Button/Button.svelte';
	import FormInput from '../Form/FormInput.svelte';
	import Input from '../Form/Input.svelte';
	import Toolbar from '../Form/Toolbar.svelte';
	import ChannelsForm from './ChannelsForm.svelte';
	import LocalesForm from './LocalesForm.svelte';
	import NamespacesForm from './NamespacesForm.svelte';

	export let project: ProjectExtended = {
		id: 0,
		name: '',
		url: '',
		description: null,
		locales: [],
		channels: [],
		namespaces: []
	};

	export let onUpdate: () => void;

	const submitTitle = project.id ? $t('a_save') : $t('a_create');

	async function handleSubmit() {
		if (!project.id) {
			const result = await createProject(project);
			if (result.data && result.data.id) {
				// navigate('/projects/' + result.data.id);
			}
			console.log(result);
		} else {
			const result = await updateProject(project.id, project);
		}
	}
	function handleUpdate() {
		loadProject();
		onUpdate();
	}
	async function handleDeleteNS(ns: Namespace) {
		await deleteProjectNamespace(ns);
		handleUpdate();
	}
	async function handleUpdateNS(ns: Namespace) {
		if (ns.id === 0) {
			await createProjectNamespace(ns);
		} else {
			await updateProjectNamespace(ns);
		}
		handleUpdate();
	}
	async function loadProject() {
		const response = await fetchProject(project.id);
		project = response.data;
	}
</script>

<form>
	<div class="flex flex-row">
		<div class="flex-1 mr-6">
			<FormInput label={$t('name')}>
				<Input bind:value={project.name} />
			</FormInput>
			<FormInput label={$t('url')}>
				<Input bind:value={project.url} />
			</FormInput>
			<FormInput label={$t('description')}>
				<Input bind:value={project.description} />
			</FormInput>
		</div>
		<div class="flex-1">
			<LocalesForm {project} onUpdate={handleUpdate} />
			<NamespacesForm {project} onUpdate={handleUpdateNS} onDelete={handleDeleteNS} />
			<ChannelsForm channels={project.channels} />
		</div>
	</div>

	<Toolbar>
		<Button onClick={handleSubmit} title={submitTitle} icon="save" />
		{#if project.id}
			<Button mode="danger" onClick={handleSubmit} title={$t('a_delete')} icon="trash" />
		{/if}
	</Toolbar>
</form>
