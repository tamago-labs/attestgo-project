import AppLayout from "@/components/app/AppLayout";

export const metadata = {
  title: "tamaGO — App",
};

export default function AppRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
