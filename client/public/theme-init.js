// Apply the saved/system preference before styles or React paint the page.
// Keep the key and accepted values aligned with ThemeProvider.
(() => {
  let theme = "system";
  try {
    const saved = localStorage.getItem("ordelino-theme");
    if (saved === "light" || saved === "dark") theme = saved;
  } catch { /* A blocked store falls back to the device preference. */ }
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
})();
