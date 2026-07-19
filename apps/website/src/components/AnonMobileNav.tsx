"use client"

import { useEffect, useState } from "react"
import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@ui/base/ui/sheet"
import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"
import { AnonNavContent } from "./AnonSidebar"

/**
 * Hamburger + left drawer for anonymous pages below `md`, where the static
 * AnonSidebar is hidden. Mirrors the authenticated dashboard's offcanvas
 * sidebar behavior.
 */
export function AnonMobileNav() {
  const [open, setOpen] = useState(false)

  // Close the drawer after a nav link inside triggers a client-side navigation.
  const pathname = usePathname()
  useEffect(() => {
    setOpen(false)
  }, [pathname])
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "rounded-full text-foreground md:hidden",
        )}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Site navigation links.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto">
          <AnonNavContent />
        </div>
      </SheetContent>
    </Sheet>
  )
}
