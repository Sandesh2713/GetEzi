
import { Button } from "../ui/button"
import { Leaf, Menu, X } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useState, useEffect } from "react"

export function Header() {
    const [isOpen, setIsOpen] = useState(false)
    const [hasScrolled, setHasScrolled] = useState(false)
    const { scrollY } = useScroll()

    useEffect(() => {
        const updateScroll = () => {
            setHasScrolled(window.scrollY > 20)
        }
        window.addEventListener("scroll", updateScroll)
        return () => window.removeEventListener("scroll", updateScroll)
    }, [])

    const headerBg = useTransform(scrollY, [0, 100], ["rgba(255,255,255,0)", "rgba(255,255,255,0.95)"])

    return (
        <motion.header
            style={{ backgroundColor: headerBg }}
            className={`fixed top-0 z-50 w-full transition-all duration-300 ${hasScrolled ? "border-b border-border/40 shadow-sm backdrop-blur-md" : ""
                }`}
        >
            <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
                    <a href="/" className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-xl font-bold tracking-tight text-foreground">GetEzi</span>
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatDelay: 3 }}
                            >
                                <Leaf className="h-5 w-5 text-primary" />
                            </motion.div>
                        </div>
                    </a>
                </motion.div>

                <nav className="hidden items-center gap-8 md:flex">
                    {[
                        { href: "#quick-access", label: "Login" },
                        { href: "#features", label: "Features" },
                        { href: "#about", label: "About Us" },
                        { href: "#contact", label: "Contact" },
                    ].map((link, index) => (
                        <motion.div
                            key={link.href}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 * index }}
                        >
                            <a
                                href={link.href}
                                className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground group"
                            >
                                {link.label}
                                <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-hover:w-full" />
                            </a>
                        </motion.div>
                    ))}
                </nav>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex items-center gap-3"
                >
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
                        className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:inline-flex"
                    >
                        100% Free
                    </motion.span>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button asChild size="sm" className="bg-foreground text-background hover:bg-foreground/90">
                            <a href="#quick-access">Login Now</a>
                        </Button>
                    </motion.div>

                    {/* Mobile menu button */}
                    <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 text-foreground">
                        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </motion.div>
            </div>

            <motion.div
                initial={false}
                animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                className="md:hidden overflow-hidden bg-background border-b border-border"
            >
                <nav className="container mx-auto flex flex-col gap-4 px-4 py-4">
                    {[
                        { href: "#quick-access", label: "Login" },
                        { href: "#features", label: "Features" },
                        { href: "#about", label: "About Us" },
                        { href: "#contact", label: "Contact" },
                    ].map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            onClick={() => setIsOpen(false)}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>
            </motion.div>
        </motion.header>
    )
}
