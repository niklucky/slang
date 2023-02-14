<script lang="ts">
	import type { Key } from '@prisma/client';
	import {
		createKey,
		updateKey,
		type KeyExtended,
		type ProjectExtended,
		type TranslationExtended
	} from '../../stores/projects';
	import Button from '../Button/Button.svelte';
	import Input from '../Form/Input.svelte';
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
			translations[translation.localeId][translation.channelId!] = translation;
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

	const submitTitle = key.id ? 'Update' : 'Create';

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
		<h3>Namespaces</h3>
		{#each project.namespaces as namespace}
			<label>
				<input type="checkbox" bind:group={namespaceId} value={namespace.id} />
				{namespace.name}
			</label>
		{/each}

		<Input label={'key'} bind:value={key.name} />

		<h3>Translations</h3>
		{#each project.locales as locale}
			<TranslationsByLocale
				{locale}
				{project}
				translationsByChannel={translations[locale.id]}
				onUpdate={handleUpdateTranslations}
			/>
		{/each}
		<Button onClick={handleSubmit} title={submitTitle} />
	</form>
</div>
