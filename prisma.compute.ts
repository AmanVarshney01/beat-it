import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  apps: {
    web: {
      name: "beat-it",
      root: "apps/web",
      framework: "custom",
      httpPort: 3000,
      build: {
        command: "bun run build:compute",
        outputDirectory: "dist",
        entrypoint: "server.mjs",
      },
    },
  },
});
