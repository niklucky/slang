<script lang="ts">
	import { t } from '../../library/i18n';
	import { createProject, updateProject } from '../../stores/projects';
	import type { Project } from '../../types';
	import Button from '../Button/Button.svelte';
	import FormInput from '../Form/FormInput.svelte';
	import Input from '../Form/Input.svelte';
	import Toolbar from '../Form/Toolbar.svelte';

	export let project: Partial<Project> = {
		name: '',
		url: '',
		description: null
	};

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
</script>

<form>
	<FormInput label={$t('name')}>
		<Input bind:value={project.name} />
	</FormInput>
	<FormInput label={$t('url')}>
		<Input bind:value={project.url} />
	</FormInput>
	<FormInput label={$t('description')}>
		<Input bind:value={project.description} />
	</FormInput>
	<Toolbar>
		<Button onClick={handleSubmit} title={submitTitle} icon="save" />
		{#if project.id}
			<Button mode="danger" onClick={handleSubmit} title={$t('a_delete')} icon="trash" />
		{/if}
	</Toolbar>
</form>
