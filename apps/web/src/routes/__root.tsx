import { Toaster } from "@beat-it/ui/components/sonner";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";

import "../index.css";

export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "Beat It — Browser stress dummy",
      },
      {
        name: "description",
        content: "Upload a face, mount it on the dummy, punch your stress away.",
      },
      {
        name: "theme-color",
        content: "#0d0d10",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <a
          href="#main-content"
          className="focus:bg-background focus:text-foreground fixed top-3 left-3 z-[60] -translate-y-20 rounded-md px-3 py-2 text-sm font-semibold transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <div className="grid h-dvh grid-rows-[auto_1fr]">
          <Header />
          <Outlet />
        </div>
        <Toaster richColors />
      </ThemeProvider>
      {import.meta.env.DEV &&
        !new URLSearchParams(window.location.search).has("demo") && (
          <TanStackRouterDevtools position="bottom-left" />
        )}
    </>
  );
}
