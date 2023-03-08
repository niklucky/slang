<script lang="ts">
	import type { Namespace, User } from '@prisma/client';
	import {
		createProjectNamespace,
		deleteProjectNamespace,
		updateProjectNamespace
	} from '../../data/api/projects';
	import { deleteUser, fetchUser, inviteUser, updateUser } from '../../data/api/users';
	import { navigate } from '../../library/navigate';
	import { t } from '../../stores/i18n';
	import Button from '../Button/Button.svelte';
	import FormInput from '../Form/FormInput.svelte';
	import Input from '../Form/Input.svelte';
	import Toolbar from '../Form/Toolbar.svelte';
	import Confirm from '../Modal/Confirm.svelte';

	export let user: User = {
		id: 0,
		name: '',
		username: '',
		password: '',
		createdAt: new Date(),
		updatedAt: new Date()
	};

	export let onUpdate: () => void;

	$: submitTitle = user.id ? $t('a_save') : $t('a_invite');
	let isDeleteConfirm = false;

	async function handleSubmit() {
		if (!user.id) {
			const result = await inviteUser(user);
			if (result.data && result.data.id) {
				navigate('/projects/' + result.data.id);
			}
			console.log(result);
		} else {
			await updateUser(user);
			onUpdate();
		}
	}
	function handleUpdate() {
		loadUser();
		onUpdate();
	}
	async function handleDeleteProject(ns: Namespace) {
		await deleteProjectNamespace(ns);
		handleUpdate();
	}
	async function handleAddProject(ns: Namespace) {
		if (ns.id === 0) {
			await createProjectNamespace(ns);
		} else {
			await updateProjectNamespace(ns);
		}
		handleUpdate();
	}
	async function loadUser() {
		const response = await fetchUser(user.id);
		user = response.data;
	}
	function handleDeleteConfirm() {
		isDeleteConfirm = true;
	}
	async function handleDelete() {
		const response = await deleteUser(user.id);
		if (response) {
			navigate('/projects');
		}
	}
</script>

<Confirm
	isOpened={isDeleteConfirm}
	title={$t('t_confirm_delete')}
	onCancel={() => (isDeleteConfirm = false)}
	onOK={handleDelete}
	okText={$t('a_confirm')}
	cancelText={$t('a_cancel')}>{$t('confirm_delete_project')}</Confirm
>

<form>
	<div class="flex flex-row">
		<div class="flex-1 mr-6">
			<FormInput label={$t('name')}>
				<Input bind:value={user.name} />
			</FormInput>
			<FormInput label={$t('username')}>
				<Input bind:value={user.username} />
			</FormInput>
			<FormInput label={$t('password')}>
				<Input bind:value={user.password} />
			</FormInput>
		</div>
		<div class="flex-1" />
	</div>

	<Toolbar>
		<Button onClick={handleSubmit} title={submitTitle} icon="save" />
		{#if user.id}
			<Button mode="danger" onClick={handleDeleteConfirm} title={$t('a_delete')} icon="trash" />
		{/if}
	</Toolbar>
</form>
