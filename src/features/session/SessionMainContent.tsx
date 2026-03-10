import { Switch, Match, lazy } from "solid-js";
import type { TabId } from "~/lib/types";

// Lazy-load tab components for performance
const ConsoleTab = lazy(() => import("~/features/console/ConsoleTab"));
const ModulesTab = lazy(() => import("~/features/module/ModulesTab"));
const ThreadsTab = lazy(() => import("~/features/thread/ThreadsTab"));
const MemoryTab = lazy(() => import("~/features/memory/MemoryTab"));
const JavaTab = lazy(() => import("~/features/java/JavaTab"));
const ObjCTab = lazy(() => import("~/features/objc/ObjCTab"));
const NativeTab = lazy(() => import("~/features/native/NativeTab"));
const ScriptTab = lazy(() => import("~/features/script/ScriptTab"));
const HooksTab = lazy(() => import("~/features/hooks/HooksTab"));
const PinboardTab = lazy(() => import("~/features/pinboard/PinboardTab"));
const CallGraphTab = lazy(() => import("~/features/callgraph/CallGraphTab"));
const NetworkTab = lazy(() => import("~/features/network/NetworkTab"));
const FilesTab = lazy(() => import("~/features/filesystem/FilesTab"));

interface SessionMainContentProps {
  activeTab: TabId;
}

export function SessionMainContent(props: SessionMainContentProps) {
  return (
    <div class="h-full overflow-hidden">
      <Switch fallback={<TabPlaceholder name={props.activeTab} />}>
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
      </Switch>
    </div>
  );
}

function TabPlaceholder(props: { name: string }) {
  return (
    <div class="flex h-full items-center justify-center text-muted-foreground">
      <span class="text-sm">{props.name} tab</span>
    </div>
  );
}
