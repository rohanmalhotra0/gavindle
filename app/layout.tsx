export const metadata = {
  title: "Gavindle",
  description: "A Wordle-style daily game for Gavin and friends.",
  icons: {
    icon: [
      { url: "/wordleFavicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/wordleFavicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/wordleFavicon/favicon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  manifest: "/site.webmanifest"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff"
};

import "./globals.css";
import React from "react";
import ClientHeader from "@/components/ClientHeader";

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientHeader />
        <main className="container">{props.children}</main>
        <footer className="app-footer">
          <div className="app-footer-inner">
            <span>Made By Rohan Malhotra - Want to make a contribution? Check out the gh repo: <a href="https://github.com/rohanmalhotra0/gavindle" style={{ color: "#787c7e" }}>here</a> | <a href="https://rohanm.org" style={{ color: "#787c7e" }}>rohanm.org</a></span>
          </div>
        </footer>
      </body>
    </html>
  );
}



