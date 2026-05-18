#!/usr/bin/env python3
"""
Extract the <style> block from
src/components/Topline/ToplineDashboard/dashboard_template.html and scope
every selector under .topline-root so it cannot leak into the dashboard.

Output: src/components/Topline/Topline.css

CSS variables (:root) remain global — they're prefixed (--ink, --bg, --gop,
etc.) and unlikely to collide with anything else in the app.

Usage:
    python scripts/port_topline_css.py
"""
import sys
import os

SRC = "src/components/Topline/ToplineDashboard/dashboard_template.html"
OUT = "src/components/Topline/Topline.css"
HEADER = """/* PRISM Topline — ported from dashboard_template.html (style block).
 * Every selector is scoped under .topline-root so it cannot leak into
 * the rest of the dashboard. CSS variables (:root) remain global —
 * they're prefixed with --bg-, --ink-, etc. and are unlikely to collide.
 *
 * To refresh: re-run scripts/port_topline_css.py. Do not hand-edit
 * individual selectors here — keep the source-of-truth alignment with
 * dashboard_template.html.
 */
"""


def extract_style_block(path):
    with open(path) as f:
        html = f.read()
    start = html.find("<style>")
    end = html.find("</style>", start)
    if start < 0 or end < 0:
        raise SystemExit("Could not locate <style>...</style> in " + path)
    return html[start + len("<style>"):end]


def split_selectors(sel):
    """Split a selector list on top-level commas (respecting parentheses)."""
    parts, depth, cur = [], 0, ""
    for ch in sel:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


def prefix_selector(sel):
    """Prepend .topline-root to a single selector, dropping html/body prefixes."""
    sel = sel.strip()
    if not sel:
        return sel
    if sel.startswith("@") or sel == ":root":
        return sel
    if sel in ("html", "body", "html, body", "html,body"):
        return ".topline-root"
    if sel.startswith("html "):
        sel = sel[5:]
    if sel.startswith("body "):
        sel = sel[5:]
    return ".topline-root " + sel


def scope(css_text):
    """Walk the CSS text and emit a scoped copy."""
    out = []
    i, n = 0, len(css_text)
    while i < n:
        # Whitespace passthrough
        while i < n and css_text[i] in " \t\n\r":
            out.append(css_text[i])
            i += 1
        if i >= n:
            break
        # Comments
        if css_text[i:i + 2] == "/*":
            j = css_text.find("*/", i + 2)
            if j < 0:
                j = n
            out.append(css_text[i:j + 2])
            i = j + 2
            continue
        # Locate the next rule's opening brace
        brace = css_text.find("{", i)
        if brace < 0:
            out.append(css_text[i:])
            break
        sel_str = css_text[i:brace]
        # Find the matching closing brace
        depth = 1
        j = brace + 1
        while j < n and depth > 0:
            if css_text[j] == "{":
                depth += 1
            elif css_text[j] == "}":
                depth -= 1
            j += 1
        body = css_text[brace + 1:j - 1]
        sel_clean = sel_str.strip()

        if sel_clean.startswith("@media") or sel_clean.startswith("@supports"):
            # Recurse for nested rules
            out.append(sel_str + "{" + scope(body) + "}")
        elif sel_clean == ":root":
            out.append(sel_str + "{" + body + "}")
        elif sel_clean in ("html", "body", "html, body", "html,body"):
            out.append(" .topline-root {" + body + "}")
        elif sel_clean == "*":
            out.append(" .topline-root *, .topline-root {" + body + "}")
        else:
            parts = split_selectors(sel_clean)
            prefixed = ", ".join(prefix_selector(p) for p in parts)
            lead = sel_str[:len(sel_str) - len(sel_str.lstrip())]
            out.append(lead + prefixed + " {" + body + "}")
        i = j
    return "".join(out)


def main():
    if not os.path.exists(SRC):
        sys.exit(f"Source template not found: {SRC}")
    raw = extract_style_block(SRC)
    scoped = scope(raw)
    with open(OUT, "w") as f:
        f.write(HEADER + scoped)
    print(f"Wrote {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
