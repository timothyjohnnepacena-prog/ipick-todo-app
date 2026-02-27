import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "iPick To Do",
  description: "To Do App for iPick",
  icons: {
    icon: "/icon.png", 
  },
};

export default function RootLayout({ children }) {
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