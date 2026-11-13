# Example: static site

Four plain HTML pages with the Parallax tracking snippet in `<head>`. No build
step, no framework.

## Use it with your own project

1. Enroll a project in Parallax and open its **Snippet** page.
2. Replace the `<script … src="/p/v1.0.0/px.js" …>` tag in each page with your
   snippet. Yours points at your Parallax origin and carries your website ID.
3. Serve the folder with anything, e.g. `npx serve .`, and open a page.
   The visit shows up on your dashboard within a minute.

## In the public demo

The stack serves this folder at `/examples/static-site/` (see the `edge` target
in the root `Dockerfile`). Because it is served from Parallax itself, the
snippet here uses a same-origin path and the fixed website ID of the
**Demo Docs** project (`packages/shared/src/demo.ts`). Opening it counts a real
visit on the public demo dashboard; `examples/load-generator` adds synthetic
visitors around the clock.

`packages/tracker/test` checks that every page embeds the current tracker
version with its exact SRI hash.
