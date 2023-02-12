<script lang="ts">
	import type { Locale } from '@prisma/client';

	export let locale: Locale;
</script>

{#if locale}
	<span class="bg-blue-400 rounded-md px-2 py-1 text-sm text-white">{locale.localeName}</span>
{/if}
