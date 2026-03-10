import { Switch, Match } from "solid-js";
import { SessionView } from "~/features/session/SessionView";
import "~/features/session/session-scope";
import { appView } from "~/features/session/session.store";
import DevicePanel from "~/features/device/DevicePanel";
import ProcessPanel from "~/features/process/ProcessPanel";

export function App() {
  return (
    <div class="flex h-screen w-screen flex-col bg-background text-foreground">
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
    </div>
  );
}
