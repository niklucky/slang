<script lang="ts">
	export let onRowClick: (() => void) | undefined = undefined;
	function handleRowClick() {
		onRowClick && onRowClick();
	}
</script>

<tr on:click={() => handleRowClick()} class="align-top cursor-pointer hover:bg-slate-50">
	<slot />
</tr>
