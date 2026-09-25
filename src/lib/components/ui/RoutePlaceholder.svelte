<script lang="ts">
  // Temporary body for routes whose feature hasn't landed yet.
  import { resolve } from "$app/paths";

  let { title } = $props<{ title: string }>();
</script>

<section class="placeholder">
  <h1 class="placeholder-title">{title}</h1>
  <p class="placeholder-text">Coming soon.</p>
  <a class="placeholder-link" href={resolve("/")}>← Back home</a>
</section>

<style lang="scss">
  .placeholder {
    @include page-shell;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-sm;
  }

  .placeholder-title {
    @include page-title;
    width: 100%;
  }

  .placeholder-text {
    color: var(--clr-text-2);
    margin-bottom: $spacing-md;
  }

  .placeholder-link {
    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    color: var(--clr-primary);
  }
</style>
