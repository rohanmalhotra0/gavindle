import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gavindle.app",
  appName: "Gavindle",
  // Next.js static export output — the same build that powers gavindle.com
  webDir: "out",
  ios: {
    contentInset: "always",
    backgroundColor: "#ffffff"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#ffffff",
      showSpinner: false
    }
  }
};

export default config;
