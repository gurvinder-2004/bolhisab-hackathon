import './globals.css';
import BottomNav from '../components/BottomNav.js';
import { Sidebar } from '../components/ui.js';

export const metadata = {
  title: 'BolHisab — हिसाब अब बोलकर',
  description: 'Voice-first khata, GST invoices and payment chasing for small manufacturers. Hisab ab bolkar.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F2F0EA',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-[#F2F0EA] text-[#1A181C] antialiased">
        <Sidebar />
        <div className="md:pl-[272px]">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
