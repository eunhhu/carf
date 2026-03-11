import { Match, Suspense, Switch, lazy, onCleanup, onMount } from "solid-js";
import "~/features/session/session-scope";
import { appView } from "~/features/session/session.store";
import { scheduleIdle } from "~/lib/scheduling";

const loadDevicePanel = () => import("~/features/device/DevicePanel");
const loadProcessPanel = () => import("~/features/process/ProcessPanel");
const loadSessionView = async () => {
	const module = await import("~/features/session/SessionView");
	return { default: module.SessionView };
};

const DevicePanel = lazy(loadDevicePanel);
const ProcessPanel = lazy(loadProcessPanel);
const SessionView = lazy(loadSessionView);

export function App() {
	onMount(() => {
		const cancelProcessPreload = scheduleIdle(() => {
			void loadProcessPanel();
		}, 120);
		const cancelSessionPreload = scheduleIdle(() => {
			void loadSessionView();
		}, 320);

		onCleanup(() => {
			cancelProcessPreload();
			cancelSessionPreload();
		});
	});

	return (
		<div class="flex h-screen w-screen flex-col bg-background text-foreground">
			<Suspense fallback={<AppLoadingScreen />}>
				<Switch>
					<Match when={appView() === "device"}>
						<DevicePanel />
					</Match>
					<Match when={appView() === "process"}>
						<ProcessPanel />
					</Match>
					<Match when={appView() === "session"}>
						<SessionView />
					</Match>
				</Switch>
			</Suspense>
		</div>
	);
}

function AppLoadingScreen() {
	return (
		<div class="flex h-full w-full items-center justify-center">
			<div class="rounded-xl border bg-surface px-4 py-3 text-sm text-muted-foreground shadow-sm">
				Loading view...
			</div>
		</div>
	);
}
