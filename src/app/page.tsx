"use client"

import { HeroSectionOne } from "@/components/hero"
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar"
import { SignInButton, useAuth } from "@clerk/nextjs"
import Link from "next/link"
import { useState } from "react"

export default function NavbarDemo() {
  const navItems = [
    { name: "Funzionalità", link: "#features" },
    { name: "Prezzi", link: "#pricing" },
    { name: "Contatto", link: "#contact" },
  ]

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isSignedIn } = useAuth()

  return (
    <div className="relative w-full">
      <Navbar>
        {/* Desktop */}
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />
          <div className="flex items-center gap-4">
            {!isSignedIn ? (
              // Use new v6 redirect props
              <SignInButton mode="modal" forceRedirectUrl="/dashboard/outbound">
                <NavbarButton variant="primary">Accedi</NavbarButton>
              </SignInButton>
            ) : (
              <Link href="/dashboard/outbound">
                <NavbarButton variant="primary">Dashboard</NavbarButton>
              </Link>
            )}
          </div>
        </NavBody>

        {/* Mobile */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <MobileNavToggle isOpen={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
          </MobileNavHeader>

          <MobileNavMenu isOpen={isMobileMenuOpen}>
            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="relative text-neutral-600 dark:text-neutral-300"
              >
                <span className="block">{item.name}</span>
              </a>
            ))}

            <div className="flex w-full flex-col gap-4">
              {!isSignedIn ? (
                <SignInButton mode="modal" forceRedirectUrl="/dashboard/outbound">
                  <NavbarButton onClick={() => setIsMobileMenuOpen(false)} variant="primary" className="w-full">
                    Accedi
                  </NavbarButton>
                </SignInButton>
              ) : (
                <Link href="/dashboard/outbound" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                  <NavbarButton variant="primary" className="w-full">
                    Dashboard
                  </NavbarButton>
                </Link>
              )}

              <NavbarButton onClick={() => setIsMobileMenuOpen(false)} variant="primary" className="w-full">
                Prenota una chiamata
              </NavbarButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      <HeroSectionOne />
    </div>
  )
}
