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
    max-width: 40rem;
    margin: $spacing-2xl auto;
    padding: $spacing-xl;
    text-align: center;
  }

  .placeholder-title {
    font-family: $font-display;
    font-size: clamp(2rem, 6vw, 3rem);
    color: var(--clr-text);
    margin-bottom: $spacing-sm;
  }

  .placeholder-text {
    color: var(--clr-text-2);
    margin-bottom: $spacing-lg;
  }

  .placeholder-link {
    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    color: var(--clr-primary);
  }
</style>
