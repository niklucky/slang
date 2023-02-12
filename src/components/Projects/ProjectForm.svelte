<script lang="ts">
	import { navigate } from '../../library/navigate';
	import { createProject, updateProject } from '../../stores/projects';
	import type { Project } from '../../types';
	import Button from '../Button/Button.svelte';
	import Input from '../Form/Input.svelte';

	export let project: Partial<Project> = {
		name: '',
		url: '',
		description: null
	};

	const submitTitle = project.id ? 'Update' : 'Create';

	async function handleSubmit() {
		if (!project.id) {
			const result = await createProject(project);
			if (result.data && result.data.id) {
				navigate('/projects/' + result.data.id);
			}
			console.log(result);
		} else {
			const result = await updateProject(project.id, project);
			navigate('/projects/' + result.data.id);
			console.log(result);
		}
	}
</script>

<form>
	<Input label={'name'} bind:value={project.name} />
	<Input label={'url'} bind:value={project.url} />
	<Input label={'description'} bind:value={project.description} />

	<Button onClick={handleSubmit} title={submitTitle} />
</form>
