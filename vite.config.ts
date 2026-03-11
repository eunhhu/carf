import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const bridgeProxyTarget =
	process.env.CARF_BRIDGE_PROXY_TARGET ?? "http://127.0.0.1:7767";

export default defineConfig({
	plugins: [solid(), tailwindcss()],
	resolve: {
		alias: {
			"~": resolve(__dirname, "src"),
		},
	},
	server: {
		port: 1420,
		strictPort: true,
		proxy: {
			"/api": {
				target: bridgeProxyTarget,
				changeOrigin: true,
			},
		},
	},
	build: {
		target: "esnext",
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		transformMode: {
			web: [/\.[jt]sx?$/],
		},
	},
});
