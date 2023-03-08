<script lang="ts">
	import type { Namespace, Word } from '@prisma/client';
	import {
		createKey,
		deleteProjectKeyById,
		updateKey,
		type ProjectExtended,
		type TranslationExtended,
		type WordExtended
	} from '../../data/api/projects';
	import { t } from '../../stores/i18n';
	import Button from '../Button/Button.svelte';
	import FormInput from '../Form/FormInput.svelte';
	import Input from '../Form/Input.svelte';
	import InputTag from '../Form/InputTag.svelte';
	import Toolbar from '../Form/Toolbar.svelte';
	import type { TOption } from '../Form/types';
	import Confirm from '../Modal/Confirm.svelte';
	import H from '../Text/H.svelte';
	import TranslationsByLocale from './TranslationsByLocale.svelte';

	export let project: ProjectExtended;
	export let onCreate: ((word: Word) => void) | undefined = undefined;
	export let onUpdate: ((word: Word) => void) | undefined = undefined;
	export let onDelete: (word: Word) => void;

	export let word: Partial<WordExtended> = {
		key: '',
		projectId: project.id,
		namespaces: []
	};

	let translations: Record<number, Record<number, Partial<TranslationExtended>>> = {};
	let isConfirmModal = false;

	project.locales.forEach((locale) => {
		if (!translations[locale.id]) {
			translations[locale.id] = {};
		}
		word.translations?.forEach((translation) => {
			if (!translations[translation.localeId]) {
				translations[translation.localeId] = {};
			}
			const channelId = translation.channelId || 0;
			translations[translation.localeId][channelId] = translation;
		});
		project.channels.forEach((channel) => {
			if (!translations[locale.id][channel.id]) {
				translations[locale.id][channel.id] = {
					wordId: word.id,
					localeId: locale.id,
					locale: locale,
					channelId: channel.id,
					channel: channel
				};
			}
		});
	});

	const submitTitle = word.id ? $t('a_save') : $t('a_add');

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
		word.translations = prepareTranslations(translations);

		if (!word.id) {
			const result = await createKey(word);
			if (result.data && result.data.id) {
				onCreate && onCreate(result.data);
			}
		} else {
			const result = await updateKey(word.id, word as Word);
			onUpdate && onUpdate(result.data);
		}
	}

	function handleDeleteConfirm() {
		isConfirmModal = true;
	}
	async function handleDelete() {
		isConfirmModal = false;
		const result = await deleteProjectKeyById(word.projectId as number, word.id as number);
		onDelete(word as Word);
	}

	function handleUpdateTranslations(
		channelId: number,
		items: Record<number, Partial<TranslationExtended>>
	) {
		translations[channelId] = items;
	}

	function handleSelectNS(options: TOption[]) {
		word.namespaces = options as Namespace[];
		word = word;
	}
	console.log('project.namespaces', project.namespaces);
	console.log('word.namespaces', word.namespaces);
</script>

<Confirm
	isOpened={isConfirmModal}
	title={$t('t_confirm_delete')}
	onCancel={() => (isConfirmModal = false)}
	onOK={handleDelete}
	okText={$t('a_confirm')}
	cancelText={$t('a_cancel')}>{$t('confirm_delete_locale')}</Confirm
>

<div class="w-[500px]">
	<form>
		{#if project.namespaces.length}
			<FormInput label={$t('namespaces')}>
				<InputTag tags={project.namespaces} selected={word.namespaces} onSelect={handleSelectNS} />
			</FormInput>
		{/if}
		<FormInput label={$t('key')}>
			<Input bind:value={word.key} />
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
			{#if word.id}
				<Button mode={'danger'} onClick={handleDeleteConfirm} title={$t('a_delete')} />
			{/if}
		</Toolbar>
	</form>
</div>
