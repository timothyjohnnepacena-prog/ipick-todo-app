import { Providers } from "./providers";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "iPick To Do",
    description: "To Do App for iPick",
    icons: {
        icon: "/icon.png",
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
