import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headerStore.get("host") || "localhost:3000";
  const forwardedProtocol = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Doodley",
      template: "%s · Doodley",
    },
    description:
      "A focused drawing-sprint studio for making crisp, dithered pixel sketches.",
    openGraph: {
      title: "Doodley — Dithered drawing sprints",
      description: "Choose a reference, beat the timer, and draw every mark on a true dithered pixel grid.",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "Doodley dithered drawing sprint studio" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Doodley — Dithered drawing sprints",
      description: "Reference on the left. Dithered pixel canvas on the right. Ready, set, sketch.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
