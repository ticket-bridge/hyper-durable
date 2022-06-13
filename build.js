import path from "path";
import { fileURLToPath } from "url";
import { build } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commonOptions = {
  bundle: true,
  sourcemap: process.env.ENV === "prod" ? false : true,
  minify: true,
  target: "esnext",
  entryPoints: [path.join(__dirname, process.env.ENV === "prod" ? "src" : "test", "index.ts")],
  outdir: path.join(__dirname, "dist"),
};

try {
  await build({
    ...commonOptions,
    format: "esm",
    outExtension: { ".js": ".mjs" },
  });
  await build({
    ...commonOptions,
    format: "cjs",
  });
} catch {
  process.exitCode = 1;
}
