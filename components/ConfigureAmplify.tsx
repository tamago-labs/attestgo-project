"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";

// Next.js App Router — must configure with ssr:true per amplify-workflow core-web.md:58
Amplify.configure(outputs, { ssr: true });

export default function ConfigureAmplify({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
