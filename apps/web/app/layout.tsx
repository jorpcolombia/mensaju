import { ClerkProvider } from "@clerk/nextjs";
import { APP_NAME } from "@messages/shared-types";
import type { ReactNode } from "react";

export const metadata = {
  title: APP_NAME,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
