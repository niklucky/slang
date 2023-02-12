<script lang="ts">
	export let data: any[] = [];
	export let fields: any[] = [];
	export let onRowClick: ((row: any) => void) | undefined = undefined;

	function handleRowClick(row: any) {
		if (onRowClick) {
			onRowClick(row);
		}
	}
</script>

<table class="table-auto w-[100%] mt-8">
	<thead class="bg-slate-50">
		<tr>
			<td>#</td>
			{#each fields as field}
				<td class="text-left p-4 text-gray-800">{field.name || field.key}</td>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each data as row, i}
			<tr on:click={() => handleRowClick(row)}>
				<td>{i + 1}</td>
				{#each fields as field}
					<td class="text-left p-4 text-gray-800">
						{#if field.component}
							<svelte:component this={field.component} {...row} />
						{:else}
							{row[field.key]}
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
