
import { Leaf } from "lucide-react"
import { motion, useInView } from "framer-motion"
import { useRef } from "react"

export function Footer() {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-50px" })

    const footerLinks = [
        {
            title: "Quick Links",
            links: [
                { href: "#quick-access", label: "Login" },
                { href: "#features", label: "Features" },
                { href: "#", label: "Integrations" },
                { href: "#", label: "Changelog" },
            ],
        },
        {
            title: "Company",
            links: [
                { href: "#", label: "About Us" },
                { href: "#", label: "Blog" },
                { href: "#", label: "Careers" },
                { href: "#", label: "Contact" },
            ],
        },
        {
            title: "Support",
            links: [
                { href: "#", label: "Help Center" },
                { href: "#", label: "FAQs" },
                { href: "#", label: "Privacy Policy" },
                { href: "#", label: "Terms of Service" },
            ],
        },
    ]

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5 },
        },
    }

    return (
        <footer id="contact" ref={ref} className="border-t border-border bg-muted/30 px-4 py-16">
            <div className="container mx-auto max-w-6xl">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="grid gap-10 md:grid-cols-4"
                >
                    <motion.div variants={itemVariants} className="md:col-span-1">
                        <a href="/" className="flex items-center gap-1 group">
                            <span className="text-xl font-bold tracking-tight text-foreground">GetEzi</span>
                            <motion.div whileHover={{ rotate: 20, scale: 1.2 }} transition={{ type: "spring", stiffness: 300 }}>
                                <Leaf className="h-5 w-5 text-primary" />
                            </motion.div>
                        </a>
                        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                            Smart queue management for modern businesses. Reduce wait times and improve customer satisfaction.
                        </p>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={isInView ? { scale: 1, opacity: 1 } : {}}
                            transition={{ delay: 0.3 }}
                            className="mt-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                        >
                            Free for everyone
                        </motion.div>
                    </motion.div>

                    {footerLinks.map((column, columnIndex) => (
                        <motion.div key={column.title} variants={itemVariants}>
                            <h4 className="font-semibold text-foreground">{column.title}</h4>
                            <ul className="mt-4 space-y-3 text-sm">
                                {column.links.map((link, linkIndex) => (
                                    <motion.li
                                        key={link.label}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={isInView ? { opacity: 1, x: 0 } : {}}
                                        transition={{ delay: 0.2 + columnIndex * 0.1 + linkIndex * 0.05 }}
                                    >
                                        <a
                                            href={link.href}
                                            className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center group"
                                        >
                                            <span className="relative">
                                                {link.label}
                                                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
                                            </span>
                                        </a>
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.5 }}
                    className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row"
                >
                    <p className="text-sm text-muted-foreground">© 2026 GetEzi. All rights reserved.</p>
                    <div className="flex items-center gap-6">
                        {["Twitter", "LinkedIn", "GitHub"].map((social, index) => (
                            <motion.div key={social} whileHover={{ y: -2, scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    {social}
                                </a>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </footer>
    )
}
