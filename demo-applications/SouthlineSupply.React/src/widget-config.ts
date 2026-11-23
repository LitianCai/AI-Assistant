/** Preview mount fields. This token is not the distributor session token. */
export const WIDGET_MOUNT_CONFIG = {
  token: "preview-demo-token",
  apiBaseUrl: "preview",
  preset: "ask",
  display: "words",
  corner: "bottom-right",
  // [ASSUMED] Teal #115e59 distinguishes this portal from Northline's blue.
  primaryColor: "#115e59",
  brandName: "Southline Supply",
  locale: "en",
} as const;
