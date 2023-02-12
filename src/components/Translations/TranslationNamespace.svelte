<script lang="ts">
	import type { Namespace } from '@prisma/client';

	export let namespace: Namespace;
</script>

{#if namespace}
	<span class="bg-purple-600 rounded-md px-2 py-1 text-sm text-white">{namespace.name}</span>
{/if}
