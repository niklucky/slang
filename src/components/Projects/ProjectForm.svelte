<script lang="ts">
	import type { Channel, Namespace } from '@prisma/client';
	import { t } from '../../library/i18n';
	import { navigate } from '../../library/navigate';
	import {
		createProject,
		createProjectChannel,
		createProjectNamespace,
		deleteProject,
		deleteProjectChannel,
		deleteProjectNamespace,
		fetchProject,
		updateProject,
		updateProjectChannel,
		updateProjectNamespace,
		type ProjectExtended
	} from '../../stores/projects';
	import Button from '../Button/Button.svelte';
	import FormInput from '../Form/FormInput.svelte';
	import Input from '../Form/Input.svelte';
	import Toolbar from '../Form/Toolbar.svelte';
	import Confirm from '../Modal/Confirm.svelte';
	import ChannelsForm from './ChannelsForm.svelte';
	import LocalesForm from './LocalesForm.svelte';
	import NamespacesForm from './NamespacesForm.svelte';

	export let project: ProjectExtended = {
		id: 0,
		name: '',
		url: '',
		description: null,
		apiKey: '',
		deletedAt: null,
		locales: [],
		channels: [],
		namespaces: []
	};

	export let onUpdate: () => void;

	$: submitTitle = project.id ? $t('a_save') : $t('a_create');
	let isDeleteConfirm = false;

	async function handleSubmit() {
		if (!project.id) {
			const result = await createProject(project);
			if (result.data && result.data.id) {
				navigate('/projects/' + result.data.id);
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
	async function handleDeleteChannel(ns: Channel) {
		await deleteProjectChannel(ns);
		handleUpdate();
	}
	async function handleUpdateChannel(ns: Channel) {
		if (ns.id === 0) {
			await createProjectChannel(ns);
		} else {
			await updateProjectChannel(ns);
		}
		handleUpdate();
	}
	async function loadProject() {
		const response = await fetchProject(project.id);
		project = response.data;
	}
	function handleDeleteConfirm() {
		isDeleteConfirm = true;
	}
	async function handleDelete() {
		const response = await deleteProject(project.id);
		if (response) {
			navigate('/projects');
		}
	}
</script>

<Confirm
	isOpened={isDeleteConfirm}
	title={$t('t_confirm_delete')}
	onCancel={() => (isDeleteConfirm = false)}
	onOK={handleDelete}
	okText={$t('a_confirm')}
	cancelText={$t('a_cancel')}>{$t('confirm_delete_project')}</Confirm
>

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
			<FormInput label={$t('apiKey')}>
				<Input disabled bind:value={project.apiKey} />
			</FormInput>
		</div>
		<div class="flex-1">
			{#if project.id}
				<LocalesForm {project} onUpdate={handleUpdate} />
				<NamespacesForm {project} onUpdate={handleUpdateNS} onDelete={handleDeleteNS} />
				<ChannelsForm {project} onUpdate={handleUpdateChannel} onDelete={handleDeleteChannel} />
			{/if}
		</div>
	</div>

	<Toolbar>
		<Button onClick={handleSubmit} title={submitTitle} icon="save" />
		{#if project.id}
			<Button mode="danger" onClick={handleDeleteConfirm} title={$t('a_delete')} icon="trash" />
		{/if}
	</Toolbar>
</form>
