import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "ajv",
    "ajv/dist/2019",
    "ajv/dist/2020",
    "json-pointer-relational",
    "html-react-parser",
    "@hyperjump/json-schema/bundle",
    "@hyperjump/json-schema/draft-2020-12"
  ],
  loader: {
    ".css": "copy"
  }
});
