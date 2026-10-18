import { Fragment, type ReactNode } from "react";

// Mini-renderer Markdown sicuro (nessun HTML grezzo): paragrafi, liste, **grassetto**, *corsivo*, `codice`, blocchi ```.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Md({ text }: { text: string }) {
  if (!text) return null;
  const blocks: ReactNode[] = [];
  const parts = text.replace(/\r/g, "").split(/```/);
  parts.forEach((part, pi) => {
    if (pi % 2 === 1) {
      const code = part.replace(/^[a-zA-Z0-9+#-]*\n/, "");
      blocks.push(
        <pre key={`c${pi}`}>
          <code>{code.replace(/\n$/, "")}</code>
        </pre>,
      );
      return;
    }
    const paras = part.split(/\n{2,}/);
    paras.forEach((para, i) => {
      const lines = para.split("\n").filter((l) => l.trim());
      if (!lines.length) return;
      const key = `${pi}-${i}`;
      if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
        const ordered = /^\s*\d/.test(lines[0]);
        const items = lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), `${key}-${j}`)}</li>);
        blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
      } else if (/^#{1,4}\s/.test(lines[0]) && lines.length === 1) {
        blocks.push(<h4 key={key}>{inline(lines[0].replace(/^#+\s/, ""), key)}</h4>);
      } else {
        blocks.push(
          <p key={key}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#+\s/, ""), `${key}-${j}`)}
              </Fragment>
            ))}
          </p>,
        );
      }
    });
  });
  return <div className="md">{blocks}</div>;
}
