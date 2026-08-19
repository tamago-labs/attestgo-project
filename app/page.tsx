import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Verification from "@/components/landing/Verification";
import Stats from "@/components/landing/Stats";
import Cta from "@/components/landing/Cta";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Verification />
      <Stats />
      <Cta />
      <Footer />
    </>
  );
}
