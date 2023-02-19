<script lang="ts">
	import type { Key } from '@prisma/client';
	import { t } from '../../library/i18n';
	import {
		createKey,
		updateKey,
		type KeyExtended,
		type ProjectExtended,
		type TranslationExtended
	} from '../../stores/projects';
	import Button from '../Button/Button.svelte';
	import FormInput from '../Form/FormInput.svelte';
	import Input from '../Form/Input.svelte';
	import InputTag from '../Form/InputTag.svelte';
	import Toolbar from '../Form/Toolbar.svelte';
	import H from '../Text/H.svelte';
	import TranslationsByLocale from './TranslationsByLocale.svelte';

	export let project: ProjectExtended;
	export let onCreate: ((key: Key) => void) | undefined = undefined;
	export let onUpdate: ((key: Key) => void) | undefined = undefined;

	export let key: Partial<KeyExtended> = {
		name: '',
		projectId: project.id,
		namespaces: []
	};

	let namespaceId = key.namespaces?.map((ns) => ns.id);
	let translations: Record<number, Record<number, Partial<TranslationExtended>>> = {};

	project.locales.forEach((locale) => {
		if (!translations[locale.id]) {
			translations[locale.id] = {};
		}
		key.translations?.forEach((translation) => {
			if (!translations[translation.localeId]) {
				translations[translation.localeId] = {};
			}
			const channelId = translation.channelId || 0;
			translations[translation.localeId][channelId] = translation;
		});
		project.channels.forEach((channel) => {
			if (!translations[locale.id][channel.id]) {
				translations[locale.id][channel.id] = {
					keyId: key.id,
					localeId: locale.id,
					locale: locale,
					channelId: channel.id,
					channel: channel
				};
			}
		});
	});

	const submitTitle = key.id ? $t('a_save') : $t('a_add');

	function prepareTranslations(
		translations: Record<number, Record<number, Partial<TranslationExtended>>>
	) {
		const t: TranslationExtended[] = [];
		Object.values(translations).forEach((records) => {
			Object.values(records).forEach((translation) => {
				t.push(translation as TranslationExtended);
			});
		});
		return t;
	}
	async function handleSubmit() {
		key.translations = prepareTranslations(translations);

		key.namespaces = project.namespaces.filter((ns) => namespaceId?.includes(ns.id));
		if (!key.id) {
			const result = await createKey(key);
			if (result.data && result.data.id) {
				onCreate && onCreate(result.data);
			}
		} else {
			const result = await updateKey(key.id, key as Key);
			onUpdate && onUpdate(result.data);
		}
	}

	function handleUpdateTranslations(
		channelId: number,
		items: Record<number, Partial<TranslationExtended>>
	) {
		translations[channelId] = items;
	}
</script>

<div class="w-[500px]">
	<form>
		<FormInput label={$t('namespaces')}>
			<InputTag tags={project.namespaces} selected={key.namespaces} />
		</FormInput>
		<FormInput label={$t('key')}>
			<Input bind:value={key.name} />
		</FormInput>

		<H size={3}>{$t('translations')}</H>
		{#each project.locales as locale}
			<TranslationsByLocale
				{locale}
				{project}
				translationsByChannel={translations[locale.id]}
				onUpdate={handleUpdateTranslations}
			/>
		{/each}
		<Toolbar>
			<Button mode="primary" onClick={handleSubmit} title={submitTitle} />
			{#if key.id}
				<Button mode={'danger'} onClick={handleSubmit} title={$t('a_delete')} />
			{/if}
		</Toolbar>
	</form>
</div>
