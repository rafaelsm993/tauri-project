<script lang="ts">
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import {
    withEmptyDisabled,
    type FilterOption,
    type StatusFilter,
    type TypeFilter,
  } from "$lib/domain/libraryView";

  // Status and Type for the Library: a bottom sheet on a phone, a popover on desktop.
  let {
    statuses,
    types,
    status,
    type,
    onstatus,
    ontype,
    onreset,
  }: {
    statuses: FilterOption<StatusFilter>[];
    types: FilterOption<TypeFilter>[];
    status: StatusFilter;
    type: TypeFilter;
    onstatus: (value: StatusFilter) => void;
    ontype: (value: TypeFilter) => void;
    onreset: () => void;
  } = $props();

  const active = $derived(status !== "all" || type !== "all");
</script>

<div class="filter-panel">
  <div class="panel-head">
    <h2 class="panel-title">Filters</h2>
    <button type="button" class="panel-reset" disabled={!active} onclick={onreset}>Reset</button>
  </div>
  <section class="panel-section">
    <h3 class="panel-label" aria-hidden="true">Status</h3>
    <SegmentedControl
      label="Status"
      options={withEmptyDisabled(statuses, status)}
      value={status}
      onchange={onstatus}
      wrap
    />
  </section>
  {#if types.length > 2}
    <section class="panel-section">
      <h3 class="panel-label" aria-hidden="true">Type</h3>
      <SegmentedControl
        label="Type"
        options={withEmptyDisabled(types, type)}
        value={type}
        onchange={ontype}
        wrap
      />
    </section>
  {/if}
</div>

<style lang="scss">
  .filter-panel {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    padding: $spacing-md $spacing-lg $spacing-lg;
    min-width: 0;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .panel-reset {
    background: none;
    border: none;
    padding: $spacing-xs 0;
    color: var(--clr-accent);
    font-size: 0.85rem;
    cursor: pointer;

    &:disabled {
      color: var(--clr-text-3);
      cursor: default;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  // Small mono caps: a label for the group, not another heading.
  .panel-label {
    font-family: $font-mono;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--clr-text-2);
  }
</style>
