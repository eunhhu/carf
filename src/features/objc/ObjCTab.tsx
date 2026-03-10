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
import { hooksState, deleteHook } from "~/features/hooks/hooks.store";
import { SplitPane } from "~/components/SplitPane";
import { CopyButton } from "~/components/CopyButton";
import { InlineActions } from "~/components/InlineActions";
import type { ActionDef, OverflowAction } from "~/components/InlineActions";
import { ActionPopover, buildClassActions } from "~/components/ActionPopover";
import { navigateTo } from "~/lib/navigation";

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

      {/* Split: Class list + Detail */}
      <SplitPane
        id="objc"
        minLeft={200}
        maxLeft={400}
        defaultLeft={280}
        left={
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
                  <div
                    class={cn(
                      "group/row flex w-full cursor-pointer items-center px-3 py-1 text-left font-mono text-xs transition-colors hover:bg-surface-hover",
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
                    <ActionPopover
                      type="class"
                      value={className}
                      actions={buildClassActions(className, "objc")}
                      class="truncate"
                    >
                      <span class="truncate" title={className}>
                        {className}
                      </span>
                    </ActionPopover>
                    <CopyButton value={className} class="ml-auto opacity-0 group-hover/row:opacity-100" />
                  </div>
                );
              }}
            </For>
          </Show>
        }
        right={
          <Show
            when={objcState.selectedClass}
            fallback={
              <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                Select a class to view details
              </div>
            }
          >
            <div class="p-4">
              <div class="mb-3 flex items-center gap-2">
                <h3 class="font-mono text-sm font-semibold" title={objcState.selectedClass!}>
                  {objcState.selectedClass}
                </h3>
                <CopyButton value={objcState.selectedClass!} />
              </div>

              <div class="flex gap-2 border-b pb-2 text-xs">
                <For each={["methods", "instances"] as const}>
                  {(tab) => (
                    <button
                      class={cn(
                        "cursor-pointer rounded px-2 py-0.5 capitalize",
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
                    {(method) => {
                      const isHooked = () => method.hooked;

                      const primaryActions = (): ActionDef[] => {
                        if (isHooked()) {
                          return [
                            {
                              label: "Unhook",
                              variant: "danger",
                              onClick: (e: MouseEvent) => {
                                e.stopPropagation();
                                const session = activeSession();
                                if (session && objcState.selectedClass) {
                                  const hook = hooksState.hooks.find(
                                    (h) =>
                                      h.type === "objc" &&
                                      h.target === `${objcState.selectedClass}::${method.selector}`,
                                  );
                                  if (hook) {
                                    deleteHook(session.id, hook);
                                  }
                                }
                              },
                            },
                          ];
                        }
                        return [
                          {
                            label: "Hook",
                            variant: "primary",
                            onClick: (e: MouseEvent) => {
                              e.stopPropagation();
                              const session = activeSession();
                              if (session && objcState.selectedClass) {
                                hookObjcMethod(session.id, objcState.selectedClass, method.selector);
                              }
                            },
                          },
                        ];
                      };

                      const overflowActions = (): OverflowAction[] => [
                        {
                          label: "Copy Selector",
                          onClick: () => {
                            navigator.clipboard.writeText(method.selector);
                          },
                        },
                        {
                          label: "View Hook Events",
                          onClick: () => {
                            navigateTo({
                              tab: "hooks",
                              context: {
                                className: objcState.selectedClass,
                                selector: method.selector,
                              },
                            });
                          },
                        },
                      ];

                      return (
                        <div class="group/row flex items-center gap-2 py-0.5 text-xs">
                          <span
                            class={cn(
                              "w-3 text-center",
                              method.type === "instance" ? "text-success" : "text-primary",
                            )}
                          >
                            {method.type === "instance" ? "-" : "+"}
                          </span>
                          <Show when={isHooked()}>
                            <span class="rounded bg-primary/10 px-1 text-[10px] text-primary">H</span>
                          </Show>
                          <span class="truncate font-mono" title={method.selector}>
                            {method.selector}
                          </span>
                          <CopyButton value={method.selector} class="opacity-0 group-hover/row:opacity-100" />
                          <div class="ml-auto">
                            <InlineActions
                              primary={primaryActions()}
                              overflow={overflowActions()}
                            />
                          </div>
                        </div>
                      );
                    }}
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
                      class="cursor-pointer rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
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
        }
      />
    </div>
  );
}

export default ObjCTab;
