import {
	Match,
	Suspense,
	Switch,
	createEffect,
	lazy,
	onCleanup,
	onMount,
} from "solid-js";
import { scheduleIdle } from "~/lib/scheduling";
import type { TabId } from "~/lib/types";

const loadConsoleTab = () => import("~/features/console/ConsoleTab");
const loadModulesTab = () => import("~/features/module/ModulesTab");
const loadThreadsTab = () => import("~/features/thread/ThreadsTab");
const loadMemoryTab = () => import("~/features/memory/MemoryTab");
const loadJavaTab = () => import("~/features/java/JavaTab");
const loadObjCTab = () => import("~/features/objc/ObjCTab");
const loadNativeTab = () => import("~/features/native/NativeTab");
const loadScriptTab = () => import("~/features/script/ScriptTab");
const loadHooksTab = () => import("~/features/hooks/HooksTab");
const loadPinboardTab = () => import("~/features/pinboard/PinboardTab");
const loadCallGraphTab = () => import("~/features/callgraph/CallGraphTab");
const loadNetworkTab = () => import("~/features/network/NetworkTab");
const loadFilesTab = () => import("~/features/filesystem/FilesTab");
const loadSwiftTab = () => import("~/features/swift/SwiftTab");
const loadIl2cppTab = () => import("~/features/il2cpp/Il2cppTab");
const loadAntiDetectTab = () => import("~/features/antidetect/AntiDetectTab");
const loadAiTab = () => import("~/features/ai/AiTab");

const TAB_LOADERS: Record<TabId, () => Promise<unknown>> = {
	console: loadConsoleTab,
	modules: loadModulesTab,
	threads: loadThreadsTab,
	memory: loadMemoryTab,
	java: loadJavaTab,
	objc: loadObjCTab,
	native: loadNativeTab,
	script: loadScriptTab,
	hooks: loadHooksTab,
	pinboard: loadPinboardTab,
	callgraph: loadCallGraphTab,
	network: loadNetworkTab,
	files: loadFilesTab,
	swift: loadSwiftTab,
	il2cpp: loadIl2cppTab,
	antidetect: loadAntiDetectTab,
	ai: loadAiTab,
};

const TAB_PRELOADS: Partial<Record<TabId, TabId[]>> = {
	console: ["modules", "threads"],
	modules: ["memory", "native"],
	threads: ["native", "callgraph"],
	memory: ["modules", "native"],
	java: ["hooks", "script"],
	objc: ["hooks", "script"],
	native: ["hooks", "callgraph", "network"],
	script: ["hooks", "console"],
	hooks: ["console", "script"],
	pinboard: ["modules", "memory"],
	callgraph: ["native", "threads"],
	network: ["files", "console"],
	files: ["network", "modules"],
	swift: ["hooks", "native"],
	il2cpp: ["hooks", "native"],
	antidetect: ["threads", "memory"],
	ai: ["console", "hooks"],
};

// Lazy-load tab components for performance
const ConsoleTab = lazy(loadConsoleTab);
const ModulesTab = lazy(loadModulesTab);
const ThreadsTab = lazy(loadThreadsTab);
const MemoryTab = lazy(loadMemoryTab);
const JavaTab = lazy(loadJavaTab);
const ObjCTab = lazy(loadObjCTab);
const NativeTab = lazy(loadNativeTab);
const ScriptTab = lazy(loadScriptTab);
const HooksTab = lazy(loadHooksTab);
const PinboardTab = lazy(loadPinboardTab);
const CallGraphTab = lazy(loadCallGraphTab);
const NetworkTab = lazy(loadNetworkTab);
const FilesTab = lazy(loadFilesTab);
const SwiftTab = lazy(loadSwiftTab);
const Il2cppTab = lazy(loadIl2cppTab);
const AntiDetectTab = lazy(loadAntiDetectTab);
const AiTab = lazy(loadAiTab);

interface SessionMainContentProps {
	activeTab: TabId;
}

export function SessionMainContent(props: SessionMainContentProps) {
	onMount(() => {
		const cancelIdlePreload = scheduleIdle(() => {
			void preloadTabComponent("modules");
			void preloadTabComponent("memory");
			void preloadTabComponent("hooks");
		}, 160);

		onCleanup(() => {
			cancelIdlePreload();
		});
	});

	createEffect(() => {
		const preloadTargets = TAB_PRELOADS[props.activeTab] ?? [];
		for (const tab of preloadTargets) {
			scheduleIdle(() => {
				void preloadTabComponent(tab);
			}, 200);
		}
	});

	return (
		<div class="h-full overflow-hidden">
			<Suspense fallback={<TabLoadingState name={props.activeTab} />}>
				<Switch>
					<Match when={props.activeTab === "console"}>
						<ConsoleTab />
					</Match>
					<Match when={props.activeTab === "modules"}>
						<ModulesTab />
					</Match>
					<Match when={props.activeTab === "threads"}>
						<ThreadsTab />
					</Match>
					<Match when={props.activeTab === "memory"}>
						<MemoryTab />
					</Match>
					<Match when={props.activeTab === "java"}>
						<JavaTab />
					</Match>
					<Match when={props.activeTab === "objc"}>
						<ObjCTab />
					</Match>
					<Match when={props.activeTab === "native"}>
						<NativeTab />
					</Match>
					<Match when={props.activeTab === "script"}>
						<ScriptTab />
					</Match>
					<Match when={props.activeTab === "hooks"}>
						<HooksTab />
					</Match>
					<Match when={props.activeTab === "pinboard"}>
						<PinboardTab />
					</Match>
					<Match when={props.activeTab === "callgraph"}>
						<CallGraphTab />
					</Match>
					<Match when={props.activeTab === "network"}>
						<NetworkTab />
					</Match>
					<Match when={props.activeTab === "files"}>
						<FilesTab />
					</Match>
					<Match when={props.activeTab === "swift"}>
						<SwiftTab />
					</Match>
					<Match when={props.activeTab === "il2cpp"}>
						<Il2cppTab />
					</Match>
					<Match when={props.activeTab === "antidetect"}>
						<AntiDetectTab />
					</Match>
					<Match when={props.activeTab === "ai"}>
						<AiTab />
					</Match>
				</Switch>
			</Suspense>
		</div>
	);
}

export function preloadTabComponent(tabId: TabId): Promise<unknown> {
	const loader = TAB_LOADERS[tabId];
	return loader ? loader() : Promise.resolve();
}

function TabLoadingState(props: { name: string }) {
	return (
		<div class="flex h-full items-center justify-center text-muted-foreground">
			<div class="rounded-xl border bg-surface px-4 py-3 text-sm shadow-sm">
				Loading {props.name}...
			</div>
		</div>
	);
}
