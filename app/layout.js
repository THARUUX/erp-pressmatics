import "./globals.css";
import { SettingsProvider } from '@/components/SettingsContext';

export const metadata = {
  title: "ERP Pressmatics",
  description: "ERP for Pressmatics",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
