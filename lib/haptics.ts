/**
 * Light haptic feedback.
 *
 * - Android/Chrome: navigator.vibrate.
 * - iOS 18+ Safari (incl. Home Screen apps): there's no vibrate API, but
 *   toggling a native `<input type="checkbox" switch>` plays the system
 *   haptic, so we click a hidden one. Must run inside a user gesture.
 */
export function haptic(kind: "light" | "success" = "light") {
  if (typeof window === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(kind === "success" ? [12, 60, 18] : 10);
      return;
    }
    iosTick();
    if (kind === "success") window.setTimeout(iosTick, 110);
  } catch {
    // Purely decorative.
  }
}

function iosTick() {
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.body.appendChild(label);
  label.click();
  label.remove();
}
