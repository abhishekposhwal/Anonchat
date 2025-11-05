export const metadata = { title: 'Anon E2EE Chat' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{margin:0}}>{children}</body>
    </html>
  );
}
