import type { Config } from "tailwindcss";
import { tailwindConfig as baseTailwindConfig } from "@tingle/ui/tailwind";

const config: Config = {
  ...baseTailwindConfig,
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
} as Config;

export default config;
