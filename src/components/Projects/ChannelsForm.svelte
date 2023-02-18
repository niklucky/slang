<script lang="ts">
	import type { Channel } from '@prisma/client';
	import { t } from '../../library/i18n';
	import Button from '../Button/Button.svelte';
	import Input from '../Form/Input.svelte';
	import Icon from '../Icon/Icon.svelte';
	import H from '../Text/H.svelte';

	export let channels: Channel[] = [];
</script>

<div>
	<H size={4}>{$t('channels')}</H>
	<Button icon="plus" />
	{#each channels as ns}
		<div class="flex flex-row py-2 items-center">
			<div class="flex-auto mr-4">
				<Input value={ns.name} />
			</div>
			<div class="w-6">
				<Icon name="minus-circle" />
			</div>
		</div>
	{/each}
</div>
