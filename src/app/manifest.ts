import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Steam — AI Fitness Coach",
    short_name: "Steam",
    description: "Your AI personal trainer, Alex — built to help you enjoy working out and stay consistent long-term.",
    start_url: "/",
    display: "standalone",
    background_color: "#570000",
    theme_color: "#b10f2e",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
