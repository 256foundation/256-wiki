/** Permalink page styles — inlined into the Lambda-rendered <style> so
 * /a/<id> pages are fully standalone (no external css fetch, works behind
 * any origin). Keep in sync with the 256F tokens in app/globals.css. */

export const PERMALINK_CSS = String.raw`
/* /a/<id> answer permalinks — rendered by the Lambda, styled standalone.
 * Same 256F tokens as the site (light + dark via system preference). */
:root {
  --sans: -apple-system, "Segoe UI", Inter, Roboto, "Helvetica Neue", sans-serif;
  --mono: "Space Mono", ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace;
  --display: "Barlow Condensed", "Arial Narrow", sans-serif;
  --paper: #ffffff;
  --paper-2: #f5f5f5;
  --deep: #13091a;
  --ink: #242424;
  --ink-2: #55505a;
  --ink-3: #8a8492;
  --line: #e5e5e5;
  --purple: #3b1445;
  --purple-dark: #2d0f36;
  --purple-light: #5c2070;
  --glow: #c084d8;
  --accent: #5c2070;
  --green: #0c8a3d;
  --amber-bg: #fdf3dd;
  --amber-line: #e8c37a;
  --amber-ink: #7c5305;
  --blue-bg: #f1eaf7;
  --blue-ink: #5c2070;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #1a1a1a;
    --paper-2: #242424;
    --ink: #f0f0f0;
    --ink-2: #c2bcc9;
    --ink-3: #8f8898;
    --line: #2a2a2a;
    --accent: #c084d8;
    --green: #00ff41;
    --amber-bg: rgba(232, 195, 122, 0.09);
    --amber-line: #6b5a2a;
    --amber-ink: #e5c67f;
    --blue-bg: #241b30;
    --blue-ink: #c084d8;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  line-height: 1.6;
}
main { max-width: 46rem; margin: 0 auto; padding: 48px 20px 64px; }
.kicker { font-family: var(--mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; margin: 0 0 18px; }
.kicker a { color: var(--ink-3); text-decoration: none; }
.kicker a:hover { color: var(--accent); }
h1 {
  font-family: var(--display); text-transform: uppercase;
  font-size: clamp(26px, 5vw, 36px); line-height: 1.12; margin: 0 0 18px;
}
.answer, .cites, footer {
  background: var(--paper-2); border: 1px solid var(--line); border-radius: 0;
  padding: 20px 22px; margin: 18px 0;
}
.cites h2 {
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--ink-3); font-family: var(--mono); margin: 0 0 10px;
}
.cites ol { margin: 0; padding-left: 20px; }
.cites li { margin: 5px 0; font-size: 14.5px; }
.cites a { color: var(--accent); }
.cites .asof {
  font-family: var(--mono); font-size: 11.5px; color: var(--blue-ink);
  background: var(--blue-bg); border-radius: 0; padding: 1px 8px; margin-left: 4px;
}
.answer { font-size: 15.5px; }
.answer h2 { font-family: var(--display); text-transform: uppercase; font-size: 21px; margin: 22px 0 8px; }
.answer h3 { font-family: var(--display); text-transform: uppercase; font-size: 17px; margin: 18px 0 6px; }
.answer p, .answer li { font-size: 15.5px; }
.answer code { font-family: var(--mono); font-size: 0.88em; background: var(--paper); border-radius: 4px; padding: 1px 5px; }
.answer pre { background: var(--purple-dark); color: #efe6f5; padding: 12px; border-radius: 0; overflow-x: auto; }
.answer blockquote { border-left: 3px solid var(--glow); margin: 12px 0; padding: 2px 14px; color: var(--ink-2); }
footer { background: none; border: none; border-top: 1px dashed var(--line); border-radius: 0;
  color: var(--ink-3); font-size: 13.5px; }
footer a { color: var(--accent); }
code { font-family: var(--mono); font-size: 0.9em; }
a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--ink); }
@media (max-width: 640px) { main { padding: 32px 16px 48px; } }

`;
