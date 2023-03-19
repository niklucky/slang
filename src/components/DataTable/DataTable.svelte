<script lang="ts">
	import { t } from '../../stores/i18n';
	import type { Field } from './types';

	export let data: any[] = [];
	export let fields: Field<unknown>[] = [];
	export let onRowClick: ((row: any) => void) | undefined = undefined;

	function handleRowClick(row: any) {
		if (onRowClick) {
			onRowClick(row);
		}
	}
	$: titles = fields.map((field) => {
		return field.title || `${field.key}`;
	});
</script>

<table class="table-auto w-[100%] mt-8">
	<thead class="bg-white border-b font-medium">
		<tr>
			<td class="text-left p-4 text-gray-500 uppercase text-sm">{$t('#')}</td>
			{#each fields as field, i}
				<td class="text-left p-4 text-gray-500  uppercase text-xs">{titles[i]}</td>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each data as row, i}
			<tr on:click={() => handleRowClick(row)} class="align-top cursor-pointer hover:bg-slate-50">
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
