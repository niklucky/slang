<script lang="ts">
	import type { TranslationExtended } from '../../stores/projects';
	import FormInput from '../Form/FormInput.svelte';
	import Input from '../Form/Input.svelte';

	export let translation: Partial<TranslationExtended>;
	export let onUpdate: (translation: Partial<TranslationExtended>) => void;

	function handleChange(value: string) {
		translation.value = value;
		onUpdate(translation);
	}
</script>

<FormInput label={translation?.channel?.name}>
	<Input onBlur={(v) => handleChange(v)} value={translation.value} />
</FormInput>
