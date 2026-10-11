export const metadata = {
  title: "Public Mining Brain — ask it anything",
};

const CHIPS = [
  "How do I build a bitcoin miner?",
  "How do I flash new firmware?",
  "Can this heat my house?",
  "How do I keep a rig cool?",
  "What's most efficient to mine?",
];

export default function HomePage() {
  return (
    <div className="landhero pcb">
      <span className="eyebrow">The 256 Foundation</span>
      <div className="landmark">
        Mining <em>Brain</em>
      </div>
      <p className="landlede">The public mining brain — ask it anything.</p>

      <form className="landbox" action="/ask" method="get">
        <input
          type="text"
          name="q"
          placeholder="Ask the brain…"
          aria-label="Ask the brain"
          autoComplete="off"
        />
        <button className="btn" type="submit">
          Ask →
        </button>
      </form>

      <ul className="chips">
        {CHIPS.map((c) => (
          <li key={c}>
            <a className="chip" href={`/ask?q=${encodeURIComponent(c)}`}>
              {c}
            </a>
          </li>
        ))}
      </ul>

      <p className="quietlinks">
        <a href="/library">browse the library →</a> ·{" "}
        <a href="/ask#connect-your-agent">use your own agent →</a>
      </p>
    </div>
  );
}
