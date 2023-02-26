<script lang="ts">
	import type { Project } from '@prisma/client';
	import Button from '../Button/Button.svelte';

	export let project: Project;

	let files: FileList;

	$: if (files) {
		// Note that `files` is of type `FileList`, not an Array:
		// https://developer.mozilla.org/en-US/docs/Web/API/FileList
		console.log(files);

		for (const file of files) {
			console.log(`${file.name}: ${file.size} bytes`);
		}
	}

	function handleImport() {
		console.log('files', files);

		const formData = new FormData();
		// formData.append('file', value);
		formData.append('file', files[0]);
		const upload = fetch(`http://localhost:5173/api/projects/${project.id}/import`, {
			method: 'POST',
			body: formData
		})
			.then((response) => response.json())
			.then((result) => {
				console.log('Success:', result);
			})
			.catch((error) => {
				console.error('Error:', error);
			});
	}
</script>

<div>
	<input accept="text/csv" bind:files type="file" />
	<Button onClick={handleImport}>Upload</Button>
</div>
