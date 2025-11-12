export const metadata = {
  title: "WhatsApp Reply Agent (No API)",
  description: "On-device AI to draft WhatsApp replies",
};

import "./globals.css";
import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header">
            <h1>WhatsApp Reply Agent</h1>
            <span className="sub">On-device AI (no API keys)</span>
          </header>
          <main>{children}</main>
          <footer className="footer">
            <span>Local-only generation ? Copy to WhatsApp</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
