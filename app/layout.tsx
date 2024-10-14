import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';
 
import { Metadata } from 'next';
 
export const metadata: Metadata = {
  title: 'My-Acme Dashboard',
  description: 'The official Next.js Course Dashboard, built with App Router, Prisma and postgresql',
 
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}