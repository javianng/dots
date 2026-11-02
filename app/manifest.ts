import type { MetadataRoute } from "next";

/**
 * Web app manifest. `display: "standalone"` is what lets iOS treat dots as an
 * installed web app once it's added to the Home Screen, which is the only way
 * iOS Safari allows Web Push notifications.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "dots",
    short_name: "dots",
    description: "A quiet way to keep your habits.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f2ec",
    theme_color: "#f5f2ec",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
