import "./globals.css";
export const metadata = { title: "Birreal", description: "Registra cada cerveza con tus amigos" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body>{children}</body></html>);
}
