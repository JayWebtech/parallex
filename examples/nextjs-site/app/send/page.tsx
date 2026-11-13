export const metadata = { title: 'Send' };

export default function Send() {
  return (
    <>
      <h1>Send</h1>
      <form className="form" action="#">
        <label>
          Destination
          <input name="to" placeholder="G…" autoComplete="off" />
        </label>
        <label>
          Amount (XLM)
          <input name="amount" inputMode="decimal" placeholder="10" />
        </label>
        <button type="button" className="button" disabled>
          Review payment
        </button>
      </form>
      <p className="muted">Disabled in the example: nothing is ever submitted.</p>
    </>
  );
}
