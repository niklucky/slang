<script lang="ts">
	import type { TranslationExtended } from '../../data/api/projects';
	import Textarea from '../Form/Textarea.svelte';
	import Tag from '../Tag/Tag.svelte';

	export let translation: Partial<TranslationExtended>;
	export let onUpdate: (translation: Partial<TranslationExtended>) => void;

	function handleChange(value: string) {
		translation.value = value;
		onUpdate(translation);
	}
</script>

<div class="flex flex-row items-center py-2">
	{#if translation.channel}
		<div class="flex w-24">
			<Tag>{translation.channel?.name}</Tag>
		</div>
	{/if}
	<div class="flex-auto">
		<Textarea onBlur={(v) => handleChange(v)} value={translation.value} />
	</div>
</div>
