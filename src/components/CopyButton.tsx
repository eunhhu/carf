import { createSignal } from "solid-js";
import { Copy, Check } from "lucide-solid";

interface CopyButtonProps {
  value: string;
  class?: string;
}

export function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = createSignal(false);

  async function handleCopy(e: MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = props.value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      class={`inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground ${props.class ?? ""}`}
      onClick={handleCopy}
      title={copied() ? "Copied!" : "Copy"}
    >
      {copied() ? <Check size={12} class="text-success" /> : <Copy size={12} />}
    </button>
  );
}
