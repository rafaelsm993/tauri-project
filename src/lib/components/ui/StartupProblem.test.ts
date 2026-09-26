import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import StartupProblem from "./StartupProblem.svelte";
import type { StartupProblem as Problem } from "$lib/types/startup";

const NEWER: Problem = {
  kind: "newer",
  file: "library.json",
  dir: "C:\\Users\\me\\AppData\\Roaming\\com.rafaelsm993.aevum",
  detail: "library.json was written by a newer version of the app (schema v9); update the app",
};

describe("StartupProblem", () => {
  it("explains a file from a newer app and asks for an update", () => {
    render(StartupProblem, { problem: NEWER });
    expect(
      screen.getByRole("heading", { name: "Your library could not be opened" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/saved by a newer version of Aevum/)).toBeInTheDocument();
    expect(screen.getByText(/update Aevum/)).toBeInTheDocument();
  });

  it("explains an unreadable file and says it was left untouched", () => {
    render(StartupProblem, { problem: { ...NEWER, kind: "unreadable", file: "prefs.json" } });
    expect(screen.getByText(/prefs.json could not be read/)).toBeInTheDocument();
    expect(screen.getByText(/nothing was changed or deleted/i)).toBeInTheDocument();
  });

  it("shows the data folder and the technical detail", () => {
    render(StartupProblem, { problem: NEWER });
    expect(screen.getByText(NEWER.dir)).toBeInTheDocument();
    expect(screen.getByText(NEWER.detail)).toBeInTheDocument();
  });

  it("copies the folder path", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(StartupProblem, { problem: NEWER });
    await user.click(screen.getByRole("button", { name: "Copy folder path" }));
    expect(writeText).toHaveBeenCalledWith(NEWER.dir);
    expect(await screen.findByRole("status")).toHaveTextContent("Copied.");
  });
});
