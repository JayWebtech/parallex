// A small Stellar-flavoured API with realistic routes, latencies and errors,
// so dashboards have something to show. No real Stellar network calls.
import express from 'express';

const app = express();
app.use(express.json());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Log-normal-ish latency: mostly fast, with a long tail. */
const latency = (medianMs) => Math.round(medianMs * Math.exp((Math.random() - 0.5) * 1.6));
const STRKEY = /^[GCM][A-Z2-7]{55,68}$/;

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/accounts/:accountId', async (req, res) => {
  await sleep(latency(40));
  if (!STRKEY.test(req.params.accountId)) return res.status(400).json({ error: 'invalid account' });
  if (Math.random() < 0.05) return res.status(404).json({ error: 'account not found' });
  res.json({ id: req.params.accountId, balances: [{ asset: 'native', balance: '100.0000000' }] });
});

app.get('/accounts/:accountId/payments', async (req, res) => {
  await sleep(latency(120));
  res.json({ account: req.params.accountId, records: [] });
});

app.get('/transactions/:hash', async (req, res) => {
  await sleep(latency(60));
  if (Math.random() < 0.08) return res.status(404).json({ error: 'not found' });
  res.json({ hash: req.params.hash, successful: true });
});

app.get('/contracts/:contractId/events', async (req, res) => {
  await sleep(latency(250));
  if (Math.random() < 0.02) return res.status(503).json({ error: 'rpc unavailable' });
  res.json({ contract: req.params.contractId, events: [] });
});

app.post('/quotes', async (req, res) => {
  await sleep(latency(180));
  if (Math.random() < 0.03) return res.status(500).json({ error: 'pricing engine error' });
  res.status(201).json({ amount: req.body?.amount ?? '1', price: '0.11' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`example-express-api on :${port}`));
