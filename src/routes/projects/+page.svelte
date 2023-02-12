<script>
	import Button from '../../components/Button/Button.svelte';
	import ProjectList from '../../components/Projects/ProjectList.svelte';
	import Title from '../../components/Title.svelte';
	import { navigate } from '../../library/navigate';

	const title = 'Projects';

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

<svelte:head>
	<title>{title}</title>
</svelte:head>
<Title {toolbar}>{title}</Title>
<ProjectList />
