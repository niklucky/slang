<script>
	import Button from '../../components/Button/Button.svelte';
	import ProjectList from '../../components/Projects/ProjectList.svelte';
	import Title from '../../components/Title.svelte';
	import { navigate } from '../../library/navigate';

	const toolbar = [
		{
			component: Button,
			props: {
				title: 'Create project',
				onClick: () => {
					navigate('/projects/create');
				}
			}
		}
	];
</script>

<Title {toolbar}>Projects</Title>
<ProjectList />
