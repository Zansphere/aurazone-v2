import { Navbar } from "@/components/layout/Navbar";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="sticky top-0 z-40 w-full">

        <Navbar />
        {/* <AnnouncementBar /> */}
      </div>
      <main className="min-h-[calc(100vh-var(--header-height))] pb-20 md:pb-0">
        {children}
      </main>
      <Footer />
      <MobileBottomNav />
      <CartDrawer />
    </>
  );
}