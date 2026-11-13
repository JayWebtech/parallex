export const metadata = { title: 'Assets' };

const ASSETS = [
  { code: 'XLM', name: 'Stellar Lumens', balance: '1,250.00' },
  { code: 'USDC', name: 'Example stablecoin', balance: '80.00' },
];

export default function Assets() {
  return (
    <>
      <h1>Assets</h1>
      <ul className="list">
        {ASSETS.map((a) => (
          <li key={a.code}>
            <strong>{a.code}</strong>
            <span className="muted">{a.name}</span>
            <span className="amount">{a.balance}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
