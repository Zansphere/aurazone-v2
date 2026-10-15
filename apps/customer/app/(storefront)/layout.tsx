import { Navbar } from "@/components/layout/Navbar";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="min-h-[calc(100vh-var(--header-height))] pt-14 pb-20 md:pb-0">
        {children}
      </main>
      <Footer />
      <MobileBottomNav />
      <CartDrawer />
    </>
  );
}