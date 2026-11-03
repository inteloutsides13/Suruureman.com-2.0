import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    const mql = typeof window.matchMedia === "function"
      ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      : null
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    if (mql && typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    }

    if (mql && typeof mql.addListener === "function") {
      mql.addListener(onChange)
      return () => mql.removeListener(onChange)
    }

    window.addEventListener("resize", onChange)
    return () => window.removeEventListener("resize", onChange)
  }, [])

  return !!isMobile
}
