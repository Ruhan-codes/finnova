// Mobile-friendly file picker. Uses a real <button> that programmatically
// clicks a visible-to-a11y-tools but sr-only <input type="file">. This is the
// reliable cross-browser pattern for iOS Safari and Android Chrome/Edge —
// hidden inputs inside <label> sometimes fail to open the picker on mobile.
import { useRef, type ReactNode } from "react";

export function MobileFileButton({
  onFile,
  disabled,
  className = "",
  children,
  accept = ".csv,text/csv,text/plain",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  accept?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        // No `capture` attribute — we want the file browser, not the camera.
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // allow re-selecting the same file
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className={className}
      >
        {children}
      </button>
    </>
  );
}
