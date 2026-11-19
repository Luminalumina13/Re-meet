# Logo

Three streams (indigo `#4A4BEF`, yellow `#FFAE00`, teal `#0FB5A5`) converge on a four-point star: people from different places meeting. The star is dark (`#0B1220`) on light backgrounds and white on dark ones. The three colours are the same in both themes and in the word mark (CSS variables `--lm-*` in `globals.css`; `--accent` and the chart series follow them).

| Where | File | Version |
| --- | --- | --- |
| Header | `src/components/LogoMark.tsx` (inline SVG, colours from the `--lm-*` variables in `globals.css`, so it follows the theme) | three chevrons per stream |
| Favicon in the browser tab | `public/favicon.svg` (transparent, adapts to `prefers-color-scheme`) | two bold chevrons per stream |
| `favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | generated, on a dark rounded tile | two bold chevrons per stream |

Everything is generated from one geometry: `python3 scripts/logo/generate.py` (run from the repository root; it needs ImageMagick for the raster files). The canvas is fitted to the real bounds of the mark, tails included, which is what keeps the outermost chevrons from being clipped. The word mark ("Re:meeet" with the three coloured "e") is plain text in `Header.tsx`.
