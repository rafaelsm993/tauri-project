import { invoke } from "@tauri-apps/api/core";
import type { StartupProblem } from "$lib/types/startup";

// null when the saved data loaded normally.
export function startupStatus(): Promise<StartupProblem | null> {
  return invoke<StartupProblem | null>("startup_status");
}
