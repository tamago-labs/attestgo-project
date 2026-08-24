import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Products from "@/components/landing/Products";
import Inbox from "@/components/landing/Inbox";
import Stats from "@/components/landing/Stats";
import Cta from "@/components/landing/Cta";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Products />
      <Inbox />
      <Stats />
      <Cta />
      <Footer />
    </>
  );
}
