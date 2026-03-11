import { createMemo, createRoot } from "solid-js";
import { createStore } from "solid-js/store";
import { scheduleTransition } from "~/lib/scheduling";
import { invoke, listen } from "~/lib/tauri";
import type { DeviceInfo } from "~/lib/types";

interface DeviceState {
	devices: DeviceInfo[];
	selectedDeviceId: string | null;
	loading: boolean;
	error: string | null;
}

type DeviceRemovedPayload = string | { id: string };

const [state, setState] = createStore<DeviceState>({
	devices: [],
	selectedDeviceId: null,
	loading: false,
	error: null,
});

const { selectedDevice } = createRoot(() => ({
	selectedDevice: createMemo(
		() => state.devices.find((d) => d.id === state.selectedDeviceId) ?? null,
	),
}));

async function refreshDevices(): Promise<void> {
	setState({ loading: true, error: null });
	try {
		const devices = await invoke<DeviceInfo[]>("list_devices");
		scheduleTransition(() => {
			setState({ devices, loading: false });
		});
	} catch (err) {
		setState({
			loading: false,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

function selectDevice(id: string): void {
	setState("selectedDeviceId", id);
}

function extractRemovedDeviceId(payload: DeviceRemovedPayload): string | null {
	if (typeof payload === "string" && payload.length > 0) {
		return payload;
	}

	if (
		typeof payload === "object" &&
		payload !== null &&
		typeof payload.id === "string" &&
		payload.id.length > 0
	) {
		return payload.id;
	}

	return null;
}

async function addRemoteDevice(address: string): Promise<void> {
	setState({ loading: true, error: null });
	try {
		await invoke("add_remote_device", { address });
		await refreshDevices();
	} catch (err) {
		setState({
			loading: false,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

async function removeRemoteDevice(address: string): Promise<void> {
	setState({ loading: true, error: null });
	try {
		await invoke("remove_remote_device", { address });
		await refreshDevices();
	} catch (err) {
		setState({
			loading: false,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

function setupDeviceListeners(): () => void {
	const unlistenAdded = listen<DeviceInfo>("carf://device/added", (device) => {
		setState("devices", (prev) => {
			const exists = prev.some((d) => d.id === device.id);
			return exists
				? prev.map((d) => (d.id === device.id ? device : d))
				: [...prev, device];
		});
	});

	const unlistenRemoved = listen<DeviceRemovedPayload>(
		"carf://device/removed",
		(payload) => {
			const id = extractRemovedDeviceId(payload);
			if (!id) {
				return;
			}

			setState("devices", (prev) => prev.filter((d) => d.id !== id));
			if (state.selectedDeviceId === id) {
				setState("selectedDeviceId", null);
			}
		},
	);

	return () => {
		unlistenAdded();
		unlistenRemoved();
	};
}

export {
	state as deviceState,
	selectedDevice,
	refreshDevices,
	selectDevice,
	addRemoteDevice,
	removeRemoteDevice,
	setupDeviceListeners,
};
