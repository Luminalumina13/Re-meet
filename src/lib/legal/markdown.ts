/**
 * A tiny Markdown subset for the legal texts: `#`, `##`, `###`, `-` lists, paragraphs,
 * **bold** and [links](/path). Output is plain data rendered as React elements, never as HTML,
 * and links are limited to site paths, https and mailto.
 */
export type Inline = { t: "text"; v: string } | { t: "b"; v: string } | { t: "a"; v: string; href: string } | { t: "todo"; v: string };

export type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string }
  | { type: "p"; inline: Inline[] }
  | { type: "ul"; items: Inline[][] };

// "//host" is a protocol-relative link to another site, so a site path must not start with two slashes.
const SAFE_HREF = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+|mailto:[^\s]+)$/;
// bold | link | a "fill me in" placeholder such as [вкажіть ... / provide ...]
const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(\[[^\]]*(?:вкажіть|provide)[^\]]*\])/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: "text", v: s.slice(last, i) });
    if (m[1] !== undefined) out.push({ t: "b", v: m[1] });
    else if (m[2] !== undefined) out.push(SAFE_HREF.test(m[3]) ? { t: "a", v: m[2], href: m[3] } : { t: "text", v: m[2] });
    else out.push({ t: "todo", v: m[4] });
    last = i + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: Inline[][] | null = null;
  let h2n = 0;
  const flush = () => {
    if (para.length) blocks.push({ type: "p", inline: parseInline(para.join(" ")) });
    para = [];
    if (list) blocks.push({ type: "ul", items: list });
    list = null;
  };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const text = h[2].trim();
      if (h[1] === "#") blocks.push({ type: "h1", text });
      else if (h[1] === "##") blocks.push({ type: "h2", text, id: `s${++h2n}` });
      else blocks.push({ type: "h3", text });
      continue;
    }
    const li = /^-\s+(.*)$/.exec(line);
    if (li) {
      if (para.length) {
        blocks.push({ type: "p", inline: parseInline(para.join(" ")) });
        para = [];
      }
      (list ??= []).push(parseInline(li[1]));
      continue;
    }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return blocks;
}
