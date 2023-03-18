<script>
	import Card from '../components/Card/Card.svelte';
	import Cards from '../components/Card/Cards.svelte';
	import LanguageSelector from '../components/LanguageSelector/LanguageSelector.svelte';
	import Link from '../components/Link/Link.svelte';
	import Logo from '../components/Logo/Logo.svelte';
	import PublicLayout from '../components/PublicLayout.svelte';
	import H from '../components/Text/H.svelte';
	import { t } from '../stores/i18n';

	let title = $t('h_slang');
	let aboutTitle = $t('t_about');
	let aboutInfo = $t('about_info');

	$: {
		title = $t('h_slang');
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<PublicLayout>
	<div class="flex flex-row justify-between items-center">
		<Logo width={150} height={75} />
		<LanguageSelector />
	</div>

	<H size={1}>{title}</H>
	<H size={2}>{$t('t_about')}</H>
	<Cards>
		<Card title={$t('about_title')}>
			{$t('about_text')}
		</Card>
		<Card title={$t('help_title')}>
			{$t('help_text')}
			<div class="mt-2">
				<Link href={'/help'}>
					{$t('a_go_to_help')}
				</Link>
			</div>
		</Card>
		<Card title={$t('projects_title')}>
			{$t('projects_text')}
			<div class="mt-2">
				<Link href={'/projects'}>
					{$t('a_go_to_projects')}
				</Link>
			</div>
		</Card>
	</Cards>
</PublicLayout>
