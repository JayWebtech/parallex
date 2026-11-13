export const metadata = { title: 'Activity' };

const ROWS = [
  { what: 'Received', amount: '+250.00 XLM', when: 'Today' },
  { what: 'Sent', amount: '−40.00 XLM', when: 'Yesterday' },
  { what: 'Swap', amount: '100.00 XLM → USDC', when: 'Monday' },
];

export default function Activity() {
  return (
    <>
      <h1>Activity</h1>
      <ul className="list">
        {ROWS.map((r) => (
          <li key={r.what + r.when}>
            <span>{r.what}</span>
            <span className="amount">{r.amount}</span>
            <span className="muted">{r.when}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
