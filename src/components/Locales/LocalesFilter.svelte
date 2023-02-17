<script lang="ts">
	import type { Locale } from '@prisma/client';
	import InputTag from '../Form/InputTag.svelte';

	export let locales: Locale[] = [];

	export let onSelect: (selected: any[]) => void;
</script>

<div>
	<InputTag tags={locales} selected={locales} {onSelect} />
</div>
