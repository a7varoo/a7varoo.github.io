(() => {
  const EN = (window.I18N && window.I18N.en) || {};
  const ES = {};
  document.querySelectorAll("[data-i18n]").forEach(el => { ES[el.dataset.i18n] = el.innerHTML; });

  function setLang(lang) {
    const dict = lang === "en" ? EN : ES;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const t = dict[el.dataset.i18n];
      if (t !== undefined) el.innerHTML = t;
    });
    document.documentElement.lang = lang;
    document.body.classList.toggle("is-en", lang === "en");
    document.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    try { localStorage.setItem("lang", lang); } catch (_) {}
  }
  window.setLang = setLang;
  document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));

  let initial = "es";
  try { initial = new URLSearchParams(location.search).get("lang") || localStorage.getItem("lang") || "es"; } catch (_) {}
  if (initial === "en") setLang("en");

  // Email ensamblado: no aparece en texto plano en el HTML.
  const addr = ["alvaro-96", "outlook.es"].join("@");
  document.querySelectorAll("[data-mail]").forEach(a => { a.href = "mailto:" + addr; if (a.dataset.mail === "show") a.textContent = addr; });

  // Reveal al scroll.
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;
  document.querySelectorAll(".reveal").forEach(el => io ? io.observe(el) : el.classList.add("in"));

  document.querySelectorAll("[data-year]").forEach(el => { el.textContent = String(new Date().getFullYear()); });
})();
