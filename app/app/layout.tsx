import AppLayout from "@/components/app/AppLayout";

export const metadata = {
  title: { absolute: "AttestGO — Inbox" },
};

export default function AppRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
