import { For, Show, createEffect } from "solid-js";
import {
  objcState,
  filteredObjcClasses,
  objcSearchQuery,
  setObjcSearchQuery,
  selectObjcClass,
  objcSubTab,
  setObjcSubTab,
  toggleAppClassesOnly,
  checkObjcAvailable,
  fetchObjcClasses,
  fetchObjcMethods,
  fetchObjcInstances,
  hookObjcMethod,
} from "./objc.store";
import { cn } from "~/lib/cn";
import { activeSession } from "~/features/session/session.store";

function ObjCTab() {
  createEffect(() => {
    const session = activeSession();
    if (session) {
      checkObjcAvailable(session.id).then(() => {
        if (objcState.available) {
          fetchObjcClasses(session.id);
        }
      });
    }
  });

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">ObjC</span>
          <Show when={objcState.available === false}>
            <span class="rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
              Not Available
            </span>
          </Show>
          <Show when={objcState.available === true}>
            <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {filteredObjcClasses().length} classes
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={objcState.appClassesOnly}
              onChange={toggleAppClassesOnly}
              class="rounded"
            />
            App only
          </label>
          <input
            type="text"
            class="rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="Search classes..."
            value={objcSearchQuery()}
            onInput={(e) => setObjcSearchQuery(e.currentTarget.value)}
          />
        </div>
      </div>

      {/* Split: Class list (40%) + Detail (60%) */}
      <div class="flex flex-1 overflow-hidden">
        <div class="w-[40%] overflow-auto border-r">
          <Show
            when={!objcState.classesLoading}
            fallback={
              <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
                Loading classes...
              </div>
            }
          >
            <For each={filteredObjcClasses()}>
              {(className) => {
                const isSelected = () => objcState.selectedClass === className;
                return (
                  <button
                    class={cn(
                      "flex w-full items-center px-3 py-1 text-left font-mono text-xs transition-colors hover:bg-surface-hover",
                      isSelected() && "bg-muted",
                    )}
                    onClick={() => {
                      selectObjcClass(className);
                      const session = activeSession();
                      if (session) {
                        fetchObjcMethods(session.id, className);
                      }
                    }}
                  >
                    <span class="truncate">{className}</span>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>

        <div class="w-[60%] overflow-auto">
          <Show
            when={objcState.selectedClass}
            fallback={
              <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                Select a class to view details
              </div>
            }
          >
            <div class="p-4">
              <h3 class="mb-3 font-mono text-sm font-semibold">
                {objcState.selectedClass}
              </h3>

              <div class="flex gap-2 border-b pb-2 text-xs">
                <For each={["methods", "instances"] as const}>
                  {(tab) => (
                    <button
                      class={cn(
                        "rounded px-2 py-0.5 capitalize",
                        objcSubTab() === tab
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setObjcSubTab(tab)}
                    >
                      {tab}
                    </button>
                  )}
                </For>
              </div>

              <Show when={objcSubTab() === "methods"}>
                <div class="mt-2">
                  <For each={objcState.methods}>
                    {(method) => (
                      <div class="flex items-center gap-2 py-0.5 text-xs">
                        <span class={cn(
                          "w-3 text-center",
                          method.type === "instance" ? "text-success" : "text-primary",
                        )}>
                          {method.type === "instance" ? "-" : "+"}
                        </span>
                        <Show when={method.hooked}>
                          <span class="rounded bg-primary/10 px-1 text-[10px] text-primary">H</span>
                        </Show>
                        <span class="font-mono">{method.selector}</span>
                        <button
                          class="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-primary/10 hover:text-primary"
                          onClick={() => {
                            const session = activeSession();
                            if (session && objcState.selectedClass) {
                              hookObjcMethod(session.id, objcState.selectedClass, method.selector);
                            }
                          }}
                        >
                          Hook
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={objcSubTab() === "instances"}>
                <div class="mt-2">
                  <div class="mb-2 text-xs text-muted-foreground">
                    Heap instances via ObjC.chooseSync()
                  </div>
                  <For each={objcState.instances}>
                    {(instance, idx) => (
                      <div class="py-0.5 font-mono text-xs">
                        [{idx()}] {String(instance)}
                      </div>
                    )}
                  </For>
                  <Show when={objcState.instances.length === 0}>
                    <button
                      class="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        const session = activeSession();
                        if (session && objcState.selectedClass) {
                          fetchObjcInstances(session.id, objcState.selectedClass);
                        }
                      }}
                    >
                      Enumerate Instances
                    </button>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

export default ObjCTab;
