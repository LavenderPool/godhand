import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { Toaster } from "@/components/ui/sonner";
import "./i18n";
import "./index.css";

function AppRoot() {
  useEffect(() => {
    if (window.self !== window.top) {
      document.documentElement.classList.add("embed-mode");
    }
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>
);
