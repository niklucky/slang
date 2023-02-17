<script lang="ts">
	import type { Locale } from '@prisma/client';
	import { getFlagEmoji } from '../../library/flags';
	import type { ProjectExtended, TranslationExtended } from '../../stores/projects';
	import H from '../Text/H.svelte';
	import TranslationForm from './TranslationForm.svelte';

	export let locale: Locale;
	export let project: ProjectExtended;
	export let translationsByChannel: Record<number, Partial<TranslationExtended>>;
	export let onUpdate: (
		localeId: number,
		translationsByChannel: Record<number, Partial<TranslationExtended>>
	) => void;

	function handleUpdate(translation: Partial<TranslationExtended>) {
		const channelId = translation ? translation.channelId : 0;
		if (!translationsByChannel) {
			translationsByChannel = {};
		}
		// @ts-ignore
		translationsByChannel[channelId] = translation;
		onUpdate(locale.id, translationsByChannel);
	}

	console.log({ locale, project, translationsByChannel });
</script>

<H size={4}>{getFlagEmoji(locale.countryCode)} {locale.title}</H>
{#each project.channels as channel}
	<TranslationForm
		translation={translationsByChannel
			? translationsByChannel[channel.id]
			: { channelId: channel.id, channel, localeId: locale.id, locale }}
		onUpdate={handleUpdate}
	/>
{/each}
