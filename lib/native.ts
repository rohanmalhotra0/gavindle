import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Share } from "@capacitor/share";

export const isNativeApp = () => Capacitor.isNativePlatform();

export function tapHaptic() {
  if (!isNativeApp()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function resultHaptic(kind: "success" | "error" | "warning") {
  if (!isNativeApp()) return;
  const type =
    kind === "success" ? NotificationType.Success : kind === "error" ? NotificationType.Error : NotificationType.Warning;
  Haptics.notification({ type }).catch(() => {});
}

/** Opens the native share sheet in the app; returns false on web so callers can fall back. */
export async function nativeShare(text: string): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    await Share.share({ text });
    return true;
  } catch {
    // user cancelled
    return true;
  }
}
