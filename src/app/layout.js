import './globals.css';
import ServiceWorkerBootstrap from '@/components/ServiceWorkerBootstrap';

export const metadata = {
  title: 'Buildogram Telecalling',
  description: 'One lead at a time telecalling for construction sales teams',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Buildogram' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport = {
  themeColor: '#1a5ee0',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerBootstrap />
      </body>
    </html>
  );
}
