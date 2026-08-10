import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The History page was removed (its detail lives in the Calendar day
      // sheet, its stats on Progress) — keep old bookmarks working.
      { source: "/history", destination: "/calendar", permanent: false },
    ];
  },
};

export default nextConfig;
