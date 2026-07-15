import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coach Alex — AI Fitness Coach",
    short_name: "Coach Alex",
    description: "Your AI personal trainer — built to help you enjoy working out and stay consistent long-term.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0a13",
    theme_color: "#6b3fa0",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
