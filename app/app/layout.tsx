import AppLayout from "@/components/app/AppLayout";

export const metadata = {
  title: "AttestGO — App",
};

export default function AppRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
