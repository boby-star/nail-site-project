import type { Metadata } from "next"; import "./globals.css";
export const metadata:Metadata={metadataBase:new URL(process.env.APP_URL??"http://localhost:3000"),title:{default:"Nailory — знання для майстрів",template:"%s — Nailory"},description:"Практичні матеріали про манікюр, догляд і розвиток beauty-бізнесу.",alternates:{canonical:"/"},openGraph:{locale:"uk_UA",type:"website"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="uk"><body>{children}</body></html>}
