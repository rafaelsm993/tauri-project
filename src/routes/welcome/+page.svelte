<script lang="ts">
  import WelcomeFlow from "$lib/components/welcome/WelcomeFlow.svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
</script>

<main class="welcome-page">
  <WelcomeFlow ondone={() => goto(resolve("/"))} />
</main>

<style lang="scss">
  .welcome-page {
    @include page-shell;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
</style>
