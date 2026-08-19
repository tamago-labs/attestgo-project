import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Verification from "@/components/landing/Verification";
import Stats from "@/components/landing/Stats";
import Cta from "@/components/landing/Cta";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <HowItWorks />
      <Verification />
      <Stats />
      <Cta />
      <Footer />
    </>
  );
}
