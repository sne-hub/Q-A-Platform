"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <Image
          className="brand-logo"
          src="/sanral-logo.jpg"
          alt="SANRAL"
          width={220}
          height={140}
          priority
        />
        <span>Q&A Dashboard.</span>
      </Link>
      <nav className="nav">
        {/* <Link href="/" data-active={pathname === "/" ? "true" : "false"}>
          Ask
        </Link> */}
     
      </nav>
    </header>
  );
}
