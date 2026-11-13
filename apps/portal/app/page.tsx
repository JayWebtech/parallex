import Link from 'next/link';
import { PRODUCT_NAME } from '@parallax/shared';

export default function Home() {
  return (
    <section className="max-w-2xl py-12">
      <h1 className="text-4xl font-semibold tracking-tight">
        Analytics for Stellar projects, without tracking people.
      </h1>
      <p className="mt-4 text-lg text-ink-2">
        {PRODUCT_NAME} gives every project its own private dashboard for website traffic and API
        usage. Add one script tag to your site, or point your OpenTelemetry exporter at us. No
        cookies, no stored IP addresses, no consent banner needed.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/sign-up" className="btn btn-primary">
          Enroll your project
        </Link>
        <Link href="/sign-in" className="btn">
          Sign in
        </Link>
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-3 text-sm text-ink-2">
        <li className="card p-4">
          <strong className="block text-ink mb-1">Web</strong>
          Page views, unique visitors, referrers, session length, bounce rate, country, device.
        </li>
        <li className="card p-4">
          <strong className="block text-ink mb-1">Isolated</strong>
          Each project sees only its own data. Operators get the cross-project view.
        </li>
        <li className="card p-4">
          <strong className="block text-ink mb-1">Pinned</strong>
          The tracker script is version-pinned with Subresource Integrity. It never updates itself.
        </li>
      </ul>
    </section>
  );
}
