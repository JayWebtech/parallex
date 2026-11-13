import Link from 'next/link';

export default function Home() {
  return (
    <>
      <p className="label">Balance</p>
      <p className="balance">1,250.00 XLM</p>
      <div className="actions">
        <Link className="button" href="/send/">
          Send
        </Link>
        <Link className="button secondary" href="/activity/">
          Activity
        </Link>
      </div>
      <p className="muted">
        This wallet is fictional. It exists to show Parallax on a Next.js app: the snippet is added
        once in the root layout with <code>next/script</code>, and client-side navigations between
        pages are counted as pageviews.
      </p>
    </>
  );
}
