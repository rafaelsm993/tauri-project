// Mirror of src-tauri/src/startup.rs; guarded by startup.contract.test.ts.
export type ProblemKind = "newer" | "unreadable";

export interface StartupProblem {
  kind: ProblemKind;
  file: string;
  dir: string;
  detail: string;
}
