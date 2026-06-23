import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BCCL Employee Management System" },
      { name: "description", content: "BCCL Employee Management System — secure portal for managing employee records." },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/ems/index.html");
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <a
        href="/ems/index.html"
        className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Open BCCL EMS →
      </a>
    </div>
  );
}
