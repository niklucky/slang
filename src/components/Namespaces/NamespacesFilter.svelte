<script lang="ts">
	import type { Namespace } from '@prisma/client';

	export let namespaces: Namespace[] = [];
</script>

<div>
	{#each namespaces as namespace}
		<div>{namespace.name}</div>
	{/each}
</div>
