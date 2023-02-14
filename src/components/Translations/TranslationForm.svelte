<script lang="ts">
	import type { TranslationExtended } from '../../stores/projects';
	import Input from '../Form/Input.svelte';

	export let translation: Partial<TranslationExtended>;
	export let onUpdate: (translation: Partial<TranslationExtended>) => void;

	// $: onUpdate(translation);
	function handleChange(value: string) {
		translation.value = value;
		onUpdate(translation);
	}
	console.log(translation);
</script>

<Input
	onBlur={(v) => handleChange(v)}
	value={translation.value}
	label={translation?.channel?.name}
/>
