import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Kaizen — Level up your every day",
    template: "%s · Kaizen",
  },
  description:
    "Track workouts, habits, and wellness. Earn points, keep streaks, climb the belts. Built for daily check-ins on your phone.",
  applicationName: "Kaizen",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kaizen",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#07070c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
