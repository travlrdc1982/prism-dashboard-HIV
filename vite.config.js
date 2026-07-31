import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Browser tab title per deployment variant.
//
// index.html is static, so Vite's import.meta.env substitution never
// reaches it — the <title> has to be rewritten at build time. This
// derives from the SAME VITE_APP_VARIANT that gates pages in
// src/data/variant.js, so a deployment can't serve the profile pages
// under the HIV title (or vice versa). One env var, one source of truth.
//
// To add a variant: add a page list in src/data/variant.js and a
// title here.
const TITLE_BY_VARIANT = {
  full: 'PRISM HIV Treatment & Prevention',
  profile: 'PRISM Audience Profiles',
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

function variantHtmlTitle() {
  return {
    name: 'prism-variant-html-title',
    transformIndexHtml(html) {
      const variant = process.env.VITE_APP_VARIANT || 'full'
      const title = TITLE_BY_VARIANT[variant] || TITLE_BY_VARIANT.full
      return html.replace(
        /<title>[\s\S]*?<\/title>/,
        `<title>${escapeHtml(title)}</title>`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), variantHtmlTitle()],
})
