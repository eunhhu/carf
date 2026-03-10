import { isTauri } from "~/lib/tauri";

export interface PickedTextFile {
	content: string;
	name: string;
	path: string | null;
}

export async function pickTextFile(
	accept: string,
): Promise<PickedTextFile | null> {
	if (isTauri()) {
		const [{ open }, { readTextFile }] = await Promise.all([
			import("@tauri-apps/plugin-dialog"),
			import("@tauri-apps/plugin-fs"),
		]);

		const selected = await open({
			multiple: false,
			filters: buildFilters(accept),
		});

		if (typeof selected !== "string") {
			return null;
		}

		return {
			content: await readTextFile(selected),
			name: selected.split("/").pop() ?? selected,
			path: selected,
		};
	}

	const input = document.createElement("input");
	input.type = "file";
	input.accept = accept;

	return new Promise<PickedTextFile | null>((resolve) => {
		input.addEventListener(
			"change",
			async () => {
				const file = input.files?.[0];
				if (!file) {
					resolve(null);
					return;
				}

				resolve({
					content: await file.text(),
					name: file.name,
					path: null,
				});
			},
			{ once: true },
		);

		input.click();
	});
}

function buildFilters(
	accept: string,
): Array<{ name: string; extensions: string[] }> {
	if (accept.includes("json")) {
		return [{ name: "JSON", extensions: ["json"] }];
	}

	if (accept.includes(".js") || accept.includes(".ts")) {
		return [
			{ name: "JavaScript", extensions: ["js", "ts"] },
			{ name: "All Files", extensions: ["*"] },
		];
	}

	return [{ name: "All Files", extensions: ["*"] }];
}
