<script lang="ts">
	import Button from '../../components/Button/Button.svelte';
	import InviteForm from '../../components/InviteForm/InviteForm.svelte';
	import Modal from '../../components/Modal/Modal.svelte';
	import Title from '../../components/Title.svelte';
	import UserList from '../../components/UserList/UserList.svelte';
	import { t } from '../../stores/i18n';

	let title = $t('h_users');
	let toolbar: any[] = [];

	$: {
		title = $t('h_users');
		toolbar = [
			{
				component: Button,
				props: {
					title: $t('a_invite_user'),
					onClick: () => {
						isInviteModal = true;
					}
				}
			}
		];
	}
	let isInviteModal = false;

	function handleCloseInviteModal() {
		isInviteModal = false;
	}
	function handleUpdate() {
		console.log('Project updated:');
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#if isInviteModal}
	<Modal
		title={$t('h_invite_user')}
		width={800}
		isOpened={isInviteModal}
		onClose={handleCloseInviteModal}><InviteForm onUpdate={handleUpdate} /></Modal
	>
{/if}

<Title {toolbar}>{title}</Title>
<UserList />
