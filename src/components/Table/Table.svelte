<script lang="ts">
	import type { Field } from './types';

	export let data: any[] = [];
	export let fields: Field<unknown>[] = [];
	export let onRowClick: ((row: any) => void) | undefined = undefined;

	function handleRowClick(row: any) {
		if (onRowClick) {
			onRowClick(row);
		}
	}
	console.log('data', data);
</script>

<table class="table-auto w-[100%] mt-8">
	<thead class="bg-slate-50">
		<tr>
			<td class="text-left p-4 text-gray-500 text-sm">#</td>
			{#each fields as field}
				<td class="text-left p-4 text-gray-500 text-sm">{field.title || field.key}</td>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each data as row, i}
			<tr
				on:click={() => handleRowClick(row)}
				class="align-top border-b cursor-pointer hover:bg-slate-50"
			>
				<td class="text-left py-2 px-4 text-gray-800 text-sm">{i + 1}</td>
				{#each fields as field}
					<td class="text-left py-2 px-4 text-gray-800 text-sm">
						{#if field.component !== undefined}
							<svelte:component this={field.component} value={row[field.key]} {row} {field} />
						{:else if field.render}
							{field.render(row[field.key])}
						{:else}
							{row[field.key]}
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
