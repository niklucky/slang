<script lang="ts">
	import type { Locale } from '@prisma/client';
	import { getFlagEmoji } from '../../library/flags';

	export let value: Locale[] = [];

	export let row;
	export let field;
</script>

{#if value.length}
	{#each value as locale}
		<span class="px-2 py-1">{getFlagEmoji(locale.countryCode)}</span>
	{/each}
{/if}
