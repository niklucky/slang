<script lang="ts">
	import { format, parseISO } from 'date-fns';
	import type { UserWithProjects } from '../../data/api/users';
	import { t } from '../../stores/i18n';
	import Dot from '../Badge/Dot.svelte';

	export let user: UserWithProjects;

	const roles: Record<number, { color: string; name: string }> = {
		1: { color: 'bg-red-500', name: 'OWNER' },
		2: { color: 'bg-lime-500', name: 'EDITOR' },
		3: { color: 'bg-cyan-500', name: 'TRANSLATOR' }
	};
</script>

<div>
	{#each user.projects as userProject, index}
		<div class="relative grid grid-cols-3 gap-4 mb-4 group">
			<div class="flex-2 ">
				<Dot color={roles[userProject.roleId].color} />
				{userProject.project.name}
			</div>
			<div class="absolute bottom-[120%] -left-[50px] group-hover:block py-2 px-4 z-10 hidden ">
				<div
					class="bg-white opacity-90 backdrop-blur-lg shadow-xl w-full h-full rounded-lg  absolute top-0 left-0 z-0"
				/>
				<div class="relative z-10">
					<div class="text-lg">{$t(roles[userProject.roleId].name)}</div>
					<div class="mb-2">
						{$t('assignedAt')}: {format(parseISO(userProject.assignedAt), 'dd.MM.yyyy')}
					</div>
					<div>{$t(`${roles[userProject.roleId].name}_info`)}</div>
				</div>
			</div>
		</div>
	{/each}
</div>
