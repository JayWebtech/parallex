# Example: Next.js site

A small, fictional wallet built with the Next.js App Router. The Parallax
snippet is added once, in `app/layout.tsx`, with `next/script`; its values live
in `app/parallax.ts`. The tracker also counts client-side navigations
(`<Link>` clicks), so a single-page app needs no extra code.

## Use it with your own project

1. Enroll a project in Parallax and open its **Snippet** page.
2. Set the values from your snippet, then build:

   ```sh
   NEXT_PUBLIC_PARALLAX_ORIGIN=https://parallax.example.org \
   NEXT_PUBLIC_PARALLAX_WEBSITE_ID=<your website id> \
   pnpm --filter @parallax/example-nextjs-site build
   ```

   If your snippet's version differs from `v1.0.0`, update `src` and
   `integrity` in `app/parallax.ts` together.

3. Serve `out/` (a static export) anywhere, and remove `basePath` from
   `next.config.ts` if you host it at the root of a domain.

## In the public demo

The stack builds this app and serves it at `/examples/nextjs-site/` (the `edge`
target in the root `Dockerfile`), with the fixed website ID of the
**Demo Wallet** project (`packages/shared/src/demo.ts`). Opening it counts a
real visit on the public demo dashboard.
