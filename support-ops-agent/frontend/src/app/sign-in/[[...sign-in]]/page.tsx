import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

const appearance = {
 variables: {
  colorPrimary: "#f36b46",
  colorBackground: "#120d11",
  colorForeground: "#f5f5f5",
  colorInput: "#090b0e",
  colorInputForeground: "#f5f5f5",
  colorNeutral: "#a1a1aa",
  borderRadius: "12px",
},
  elements: {
    card: "border border-[#8d2d28]/55 shadow-[0_0_30px_rgba(116,21,19,0.2)]",
    headerTitle: "text-white",
    headerSubtitle: "text-zinc-400",
    formFieldLabel: "text-zinc-300",
    formFieldInput: "border-white/10",
    formButtonPrimary:
      "bg-gradient-to-r from-[#f36b46] to-[#7f1b1d] hover:brightness-110",
    footerActionLink: "text-[#ff9a67] hover:text-[#ffbe94]",
  },
};


export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
  <SignIn appearance={appearance} />
  <Link
    href="/demo"
    className="text-sm text-[#ff9a67] underline underline-offset-4 hover:text-[#ffbe94]"
  >
    Try the demo without signing up
  </Link>
</div>
  );
}





