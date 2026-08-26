import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import DocsNav from "@/components/docs/DocsNav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 grid lg:grid-cols-[240px_1fr] gap-8">
          <aside className="hidden lg:block sticky top-[88px] h-fit">
            <DocsNav />
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
      <Footer />
    </>
  );
}
