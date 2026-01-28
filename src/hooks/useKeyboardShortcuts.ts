import { useEffect, useCallback } from 'react';

type ModifierKey = 'mod' | 'ctrl' | 'alt' | 'shift' | 'meta';
type KeyBinding = string; // e.g., "mod+k", "ctrl+shift+f"

interface ShortcutHandler {
  key: KeyBinding;
  handler: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  // Only trigger when not in input/textarea
  ignoreWhenEditing?: boolean;
}

// Parse key binding string into parts
function parseKeyBinding(binding: string): { modifiers: Set<ModifierKey>; key: string } {
  const parts = binding.toLowerCase().split('+');
  const key = parts.pop() || '';
  const modifiers = new Set<ModifierKey>(parts as ModifierKey[]);
  return { modifiers, key };
}

// Check if event matches binding
function matchesBinding(e: KeyboardEvent, binding: string): boolean {
  const { modifiers, key } = parseKeyBinding(binding);

  // Check modifiers
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Handle 'mod' as Cmd on Mac, Ctrl elsewhere
  const modPressed = modifiers.has('mod')
    ? isMac
      ? e.metaKey
      : e.ctrlKey
    : true;

  const ctrlPressed = modifiers.has('ctrl') ? e.ctrlKey : !e.ctrlKey || modifiers.has('mod');
  const altPressed = modifiers.has('alt') ? e.altKey : !e.altKey;
  const shiftPressed = modifiers.has('shift') ? e.shiftKey : !e.shiftKey;
  const metaPressed = modifiers.has('meta')
    ? e.metaKey
    : !e.metaKey || (modifiers.has('mod') && isMac);

  // If mod is used, we need special handling
  let modifierMatch: boolean;
  if (modifiers.has('mod')) {
    modifierMatch =
      modPressed &&
      altPressed === modifiers.has('alt') &&
      shiftPressed === modifiers.has('shift');
  } else {
    modifierMatch = ctrlPressed && altPressed && shiftPressed && metaPressed;
  }

  // Check key
  const keyMatch = e.key.toLowerCase() === key || e.code.toLowerCase() === `key${key}`;

  return modifierMatch && keyMatch;
}

// Check if currently editing
function isEditing(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') return true;

  // Check for contenteditable
  if (activeElement.getAttribute('contenteditable') === 'true') return true;

  return false;
}

// Main hook
export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (matchesBinding(e, shortcut.key)) {
          // Skip if editing and ignoreWhenEditing is true
          if (shortcut.ignoreWhenEditing && isEditing()) {
            continue;
          }

          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }

          if (shortcut.stopPropagation) {
            e.stopPropagation();
          }

          shortcut.handler(e);
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Convenience hook for single shortcut
export function useKeyboardShortcut(
  key: KeyBinding,
  handler: (e: KeyboardEvent) => void,
  options?: {
    preventDefault?: boolean;
    stopPropagation?: boolean;
    ignoreWhenEditing?: boolean;
    enabled?: boolean;
  }
) {
  useKeyboardShortcuts(
    options?.enabled === false
      ? []
      : [
          {
            key,
            handler,
            preventDefault: options?.preventDefault,
            stopPropagation: options?.stopPropagation,
            ignoreWhenEditing: options?.ignoreWhenEditing,
          },
        ]
  );
}

// Global shortcuts setup hook (to be used in App.tsx)
export function useGlobalShortcuts({
  onOpenCommandPalette,
  onOpenSettings,
  onToggleLibrary,
  onToggleConsole,
  onSwitchTab,
}: {
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onToggleLibrary: () => void;
  onToggleConsole: () => void;
  onSwitchTab: (tab: string) => void;
}) {
  useKeyboardShortcuts([
    // Command palette
    {
      key: 'mod+k',
      handler: onOpenCommandPalette,
      ignoreWhenEditing: false,
    },
    // Settings
    {
      key: 'mod+,',
      handler: onOpenSettings,
      ignoreWhenEditing: true,
    },
    // Toggle library panel
    {
      key: 'mod+shift+l',
      handler: onToggleLibrary,
      ignoreWhenEditing: true,
    },
    // Toggle console/bottom panel
    {
      key: 'mod+`',
      handler: onToggleConsole,
      ignoreWhenEditing: true,
    },
    // Tab switching (1-9)
    ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => ({
      key: `mod+${num}` as KeyBinding,
      handler: () => {
        const tabs = [
          'attach',
          'native',
          'memory',
          'methods',
          'thread',
          'objc',
          'swift',
          'java',
          'console',
        ];
        const index = parseInt(num) - 1;
        if (index < tabs.length) {
          onSwitchTab(tabs[index]);
        }
      },
      ignoreWhenEditing: true,
    })),
  ]);
}
