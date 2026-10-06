import { defineConfig } from "tsup";

// One readable file, zero runtime dependencies: fflate is inlined so `npx flyee`
// downloads nothing but this package. Not minified on purpose: the member can
// read what runs on their machine.
export default defineConfig({
  entry: { flyee: "src/main.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  bundle: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  clean: true,
  dts: false,
  noExternal: ["fflate"],
  banner: { js: "#!/usr/bin/env node" },
});
