<script lang="ts">
	import type { Locale } from '@prisma/client';
	import { onMount } from 'svelte';
	import { t } from '../../library/i18n';
	import {
		addLocaleToProject,
		deleteLocaleFromProject,
		fetchLocales,
		updateLocaleInProject,
		type ProjectExtended
	} from '../../stores/projects';
	import Select from '../Form/Select.svelte';
	import type { TOption } from '../Form/types';
	import Icon from '../Icon/Icon.svelte';
	import Confirm from '../Modal/Confirm.svelte';
	import H from '../Text/H.svelte';

	export let project: ProjectExtended;
	export let onUpdate: () => void;

	$: locales = project.locales;

	let allLocales: TOption[] = [];
	let isOpened = false;
	let selected: Locale | null = null;

	function handleDeleteConfirm(locale: Locale) {
		isOpened = true;
		selected = locale;
	}
	async function handleDelete() {
		if (selected) {
			console.log('selected', selected);
			const result = await deleteLocaleFromProject(project.id, selected.id as number);
			console.log('result', result);
			isOpened = false;
			selected = null;
			onUpdate();
		}
	}
	function handleChangeLocale(current: TOption) {
		return async function handleNewLocale(locale: TOption) {
			console.log('handleChangeLocale', current, locale);
			const result = await updateLocaleInProject(
				project.id,
				current.id as number,
				locale.id as number
			);
			console.log('result', result);
			onUpdate();
		};
	}
	async function handleAddLocale(current: TOption) {
		console.log('handleAddLocale', current);
		const result = await addLocaleToProject(project.id, current.id as number);
		console.log('result', result);
		onUpdate();
	}
	async function loadLocales() {
		const response = await fetchLocales();
		allLocales = response.data;
	}

	onMount(() => {
		loadLocales();
	});
</script>

<Confirm
	{isOpened}
	title={$t('t_confirm_delete')}
	onCancel={() => (isOpened = false)}
	onOK={handleDelete}
	okText={$t('a_confirm')}
	cancelText={$t('a_cancel')}>{$t('confirm_delete_locale')}</Confirm
>

<div>
	<H size={4}>{$t('locales')}</H>
	{#each locales as ns}
		<div class="flex flex-row py-2 items-center">
			<div class="flex-auto mr-4">
				<Select options={allLocales} value={ns} onChange={handleChangeLocale(ns)} />
			</div>
			<div class="w-6">
				<Icon name="minus-circle" onClick={() => handleDeleteConfirm(ns)} />
			</div>
		</div>
	{/each}
	<div class="flex flex-row py-2 items-center">
		<div class="flex-auto mr-4">
			<Select
				options={allLocales}
				value={undefined}
				placeholder="select option"
				onChange={handleAddLocale}
			/>
		</div>
		<div class="w-6" />
	</div>
</div>
