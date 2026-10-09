import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 outline-none font-semibold select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 aria-busy:cursor-progress aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Black pill (white pill in dark mode)
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        // Periwinkle soft pill for secondary emphasis
        soft: "bg-brand-soft text-foreground hover:bg-[color-mix(in_oklch,var(--brand-soft),var(--brand)_18%)]",
        outline:
          "border-border bg-card hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-muted text-foreground hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)] aria-expanded:bg-muted",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-error-soft text-error hover:bg-[color-mix(in_oklch,var(--error-soft),var(--error)_12%)]",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-5 text-[0.9375rem]",
        sm: "h-11 gap-1.5 px-3 text-sm",
        lg: "h-12 gap-2 px-6 text-base",
        xl: "h-14 gap-2.5 px-7 text-base",
        icon: "size-11",
        "icon-sm": "size-11 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
