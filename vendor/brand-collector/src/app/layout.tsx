import './globals.css'

export const metadata = {
  title: 'Brand Collector',
  description: 'Collect and analyze your brand content',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
