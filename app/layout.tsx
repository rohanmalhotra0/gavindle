export const metadata = {
  title: "Gavindle",
  description: "A Wordle-style daily game for Gavin and friends.",
  metadataBase: new URL("https://example.com")
};

import "./globals.css";
import React from "react";

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div className="app-header-inner">
            <h1 className="brand">Gavindle</h1>
          </div>
        </header>
        <main className="container">{props.children}</main>
        <footer className="app-footer">
          <div className="app-footer-inner">
            <span>Made for Gavin, Happy Birthday! We love you! - Rohan, Tomas, Zach</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

