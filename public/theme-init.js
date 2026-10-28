(function () {
  try {
    var theme = localStorage.getItem("torrnet-theme") || "system";
    var accent = localStorage.getItem("torrnet-accent") || "violet";
    if (["violet", "ocean", "forest", "amber"].indexOf(accent) < 0) {
      accent = "violet";
    }
    var dark =
      theme === "dark" ||
      (theme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset.accent = accent;
    root.style.colorScheme = dark ? "dark" : "light";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", dark ? "#0C0C11" : "#F6F5FB");
    }
  } catch (error) {
    /* 首屏主题缓存不可用时回退到默认值 */
  }
})();