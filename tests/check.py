#!/usr/bin/env python3
"""Comprobaciones del portfolio: estructura, privacidad e i18n. Solo stdlib."""
import json, re, sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX, I18N, APP = ROOT / "index.html", ROOT / "i18n.js", ROOT / "app.js"
SECTIONS = ["hero", "linux", "metricas", "ia", "proyectos", "experiencia", "formacion", "contacto"]

# La privacidad se comprueba con patrones, no con una lista de datos reales:
# este fichero es público y no debe contener lo que pretende mantener fuera.
IPV4 = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")
PHONE = re.compile(r"\b[67]\d{2}[ .-]?\d{3}[ .-]?\d{3}\b")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[A-Za-z]{2,}")
# Tokens concretos (hostnames, etc.) en un fichero local ignorado por git.
LOCAL_FORBIDDEN = ROOT / "tests" / "forbidden.local.txt"


def es_privada(ip):
    try:
        o = [int(x) for x in ip.split(".")]
    except ValueError:
        return False
    if any(x > 255 for x in o):
        return False
    return (
        o[0] in (10, 127)
        or (o[0] == 192 and o[1] == 168)
        or (o[0] == 172 and 16 <= o[1] <= 31)
    )


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.hrefs, self.keys, self.imgs, self.lang = set(), [], [], [], None
        self.text, self._svg = [], 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "svg":
            self._svg += 1
        if tag == "html":
            self.lang = a.get("lang")
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "a" and a.get("href"):
            self.hrefs.append(a["href"])
        if a.get("data-i18n"):
            self.keys.append(a["data-i18n"])
        if tag == "img":
            self.imgs.append(a.get("src", ""))

    def handle_endtag(self, tag):
        if tag == "svg" and self._svg:
            self._svg -= 1

    def handle_data(self, data):
        if not self._svg:
            self.text.append(data)


def main():
    fails = []
    ok = lambda cond, msg: None if cond else fails.append(msg)

    ok(INDEX.exists(), "falta index.html")
    ok(APP.exists(), "falta app.js")
    ok(I18N.exists(), "falta i18n.js")
    if fails:
        return report(fails)

    html = INDEX.read_text(encoding="utf-8")
    page = Page()
    page.feed(html)
    ok(page.lang == "es", "html[lang] debe ser 'es'")
    for s in SECTIONS:
        ok(s in page.ids, f"falta la sección #{s}")
    for h in page.hrefs:
        if h.startswith("#"):
            ok(h[1:] in page.ids, f"ancla rota: {h}")
    for src in page.imgs:
        if not src.startswith(("http", "data:")):
            ok((ROOT / src).exists(), f"imagen inexistente: {src}")

    # Privacidad: sobre el texto visible (el SVG queda fuera: son coordenadas).
    texto = "".join(page.text)
    for ip in IPV4.findall(texto):
        ok(not es_privada(ip), f"IP privada en index.html: {ip}")
    for tel in PHONE.findall(texto):
        ok(False, f"posible teléfono en index.html: {tel}")
    for mail in EMAIL.findall(html):
        ok(False, f"email en claro en index.html: {mail} (debe ensamblarse en app.js)")
    if LOCAL_FORBIDDEN.exists():
        for line in LOCAL_FORBIDDEN.read_text(encoding="utf-8").splitlines():
            tok = line.strip()
            if tok and not tok.startswith("#"):
                ok(tok not in html, f"texto prohibido en index.html: {tok!r}")
    else:
        print(f"aviso: sin {LOCAL_FORBIDDEN.name}, no se comprueban tokens concretos")

    raw = I18N.read_text(encoding="utf-8").strip()
    m = re.fullmatch(r"window\.I18N\s*=\s*(\{.*\})\s*;?", raw, re.S)
    ok(m is not None, "i18n.js debe ser 'window.I18N = {json};'")
    en = {}
    if m:
        try:
            en = json.loads(m.group(1))["en"]
        except Exception as e:  # noqa: BLE001
            fails.append(f"i18n.js no es JSON válido: {e}")
    dup = sorted({k for k in page.keys if page.keys.count(k) > 1})
    ok(not dup, f"claves data-i18n duplicadas: {dup}")
    missing = [k for k in page.keys if k not in en]
    ok(not missing, f"claves sin traducción EN: {missing}")
    extra = [k for k in en if k not in page.keys]
    ok(not extra, f"traducciones EN sin elemento: {extra}")
    return report(fails)


def report(fails):
    if fails:
        print("FAIL")
        for f in fails:
            print(" -", f)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
