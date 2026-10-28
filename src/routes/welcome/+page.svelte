<script lang="ts">
  import WelcomeFlow from "$lib/components/welcome/WelcomeFlow.svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { prefsStore } from "$lib/stores/prefs.svelte";
</script>

<main class="welcome-page">
  {#if prefsStore.ready}
    <WelcomeFlow ondone={() => goto(resolve("/"))} />
  {/if}
</main>

<style lang="scss">
  .welcome-page {
    @include page-shell;
    padding-top: max(#{$spacing-2xl}, calc(var(--safe-top) + #{$spacing-xl}));
    width: min(100%, 48rem);

    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
</style>
