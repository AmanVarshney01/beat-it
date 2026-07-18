<div align="center">

# Beat It

**A ridiculous 3D face-punching booth that runs entirely in your browser.**

Upload a face, choose your attack, and hit exactly where you click.

[**Play Beat It →**](https://beatit.amanv.dev/)

</div>

## What is Beat It?

Beat It is a browser-based slapstick game built around a fully interactive 3D
face. Drop in a photo—or use the included demo—then punch, slap, bonk, and splat
the dummy while the head reacts with deformation, recoil, damage marks, sound,
and optional spoken reactions.

The available attacks are:

- Punch
- Slap
- Mallet
- Tomato
- Egg

This is intentionally silly, blood-free, and built for quick stress relief.

## Highlights

- **Exact hit placement** — attacks and marks land on the point you target.
- **Real 3D reactions** — the face deforms, recoils, rotates, and recovers after
  each impact.
- **Authored weapons** — the glove, hand, mallet, tomato, egg, dummy, and cap
  use optimized Blender models.
- **Persistent damage** — bruises and food residue stay attached to the correct
  face position while it moves.
- **Funny reactions** — choose a male voice, female voice, or turn reactions
  off.
- **Custom character style** — pick a stage and add a colorable cap with your
  own short label.
- **Adaptive performance** — rendering quality adjusts to keep gameplay
  responsive across desktop and mobile devices.

## Privacy

**Your photo never leaves your device.**

Face detection, landmark tracking, cropping, texture generation, and rendering
all happen locally inside the browser. Beat It has no image-upload backend and
does not send face photos to a server.

## Controls

| Input | Action |
| --- | --- |
| Click or tap the face | Attack the exact targeted point |
| `Space` | Swing the selected attack |
| `1`–`5` | Select punch, slap, mallet, tomato, or egg |
| Settings button | Change sound, voice, stage, cap, effects, and motion |
| Reset button | Clear hits and damage |
| New face button | Return to the upload screen |

## Built with

- [React](https://react.dev/) and
  [TanStack Router](https://tanstack.com/router)
- [Three.js](https://threejs.org/) for the 3D scene, lighting, raycasting, and
  face mesh
- [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
  for local face detection and landmarks
- [Matter.js](https://brm.io/matter-js/) for head recoil and spring physics
- [Blender](https://www.blender.org/) for the authored game assets
- [Tailwind CSS](https://tailwindcss.com/) for the interface
- [Bun](https://bun.sh/) and [Turborepo](https://turborepo.com/) for the
  monorepo toolchain
- [Prisma Compute](https://www.prisma.io/compute) for production hosting

## Run locally

### Requirements

- [Bun](https://bun.sh/) 1.3 or newer
- A modern browser with WebGL support

### Setup

```bash
git clone https://github.com/AmanVarshney01/beat-it.git
cd beat-it
bun install
bun run dev:web
```

Open [http://localhost:3001](http://localhost:3001).

### Useful commands

```bash
bun run dev          # Start the workspace in development mode
bun run dev:web      # Start only the web app
bun run build        # Build the workspace
bun run check-types  # Build and type-check the workspace
```

## Project structure

```text
beat-it/
├── apps/web/            # React app and Three.js game runtime
├── packages/ui/         # Shared interface components and styles
├── packages/config/     # Shared TypeScript configuration
├── packages/env/        # Environment definitions
├── tools/blender/       # Reproducible Blender asset pipeline
├── openspec/            # Product specifications and implementation changes
└── prisma.compute.ts    # Prisma Compute deployment configuration
```

## Deployment

The production build is configured as the `web` target in
[`prisma.compute.ts`](./prisma.compute.ts). With an authenticated Prisma CLI:

```bash
bunx @prisma/cli@latest app deploy web --prod --yes --no-db
```

Production: [https://beatit.amanv.dev/](https://beatit.amanv.dev/)

## Responsible use

Use photos you own or have permission to use. Beat It is a fictional,
cartoon-style game and is not intended to encourage harassment or real-world
violence.
