"use client";

import { useEffect, useState } from "react";

/** Hamburger button + backdrop driving the mobile nav drawer (body.nav-open). */
export default function NavToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".sidebar a")) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("nav-open");
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>
      <div
        className="nav-backdrop"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
    </>
  );
}
