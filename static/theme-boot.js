// Paints the last chosen theme before the app loads; the saved prefs take over once they arrive.
try {
  const theme = localStorage.getItem("aevum.theme");
  if (theme === "dark" || theme === "light" || theme === "system") {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "system" ? "light dark" : theme;
  }
} catch {
  document.documentElement.dataset.theme = "system";
}
