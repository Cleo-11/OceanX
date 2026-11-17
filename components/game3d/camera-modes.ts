/**
 * Camera views for the dive scene. Kept apart from the scene itself so the HUD
 * can use them without pulling three.js into the page's initial bundle.
 */
export type CameraMode = "overhead" | "chase" | "cockpit"

export const CAMERA_MODES: CameraMode[] = ["overhead", "chase", "cockpit"]

export const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  overhead: "Overhead",
  chase: "Chase",
  cockpit: "Cockpit",
}
