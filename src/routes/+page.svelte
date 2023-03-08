<script>
	import Title from '../components/Title.svelte';
	import { t } from '../stores/i18n';

	$: title = $t('h_dashboard');
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>
<Title>{title}</Title>
<ul class="text-sky-500">
	<li><a href="/dashboard">{$t('menu_dashboard')}</a></li>
	<li><a href="/projects">{$t('menu_projects')}</a></li>
</ul>
