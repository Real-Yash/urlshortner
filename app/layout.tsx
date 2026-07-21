import "./globals.css";

export const metadata = { title: "Zylin — production link infrastructure", description: "Create and manage short links from your dashboard or API." };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
