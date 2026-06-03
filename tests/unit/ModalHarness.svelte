<script lang="ts">
  import Button from '../../src/lib/components/atoms/Button.svelte';
  import Modal from '../../src/lib/components/molecules/Modal.svelte';

  export let initiallyOpen = false;

  let open = initiallyOpen;

  function closeModal() {
    open = false;
  }
</script>

<Button variant="danger" on:click={() => (open = true)}>
  Open modal
</Button>

<Modal open={open} labelledBy="modal-test-title" on:close={closeModal}>
  <h2 id="modal-test-title" slot="header">Delete User</h2>

  <p>Are you sure you want to delete this user?</p>
  <a href="/users/delete-help">Review delete policy</a>

  <div slot="footer">
    <Button variant="secondary" on:click={closeModal}>
      Cancel
    </Button>
    <Button variant="danger" on:click={closeModal}>
      Delete
    </Button>
  </div>
</Modal>
