import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function copyGameModule() {
  return {
    name: "copy-game-module",
    closeBundle() {
      const source = resolve("game");
      const target = resolve("dist/game");
      if (existsSync(source)) {
        cpSync(source, target, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyGameModule()]
});
