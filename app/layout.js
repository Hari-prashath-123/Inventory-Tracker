import './globals.css'

export const metadata = {
  title: 'Store Inventory Reorder Tracker',
  description: 'Track inventory levels and manage reorder alerts across store locations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}