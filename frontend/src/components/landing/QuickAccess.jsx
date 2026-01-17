
import { Button } from "../ui/button"
import { Building2, UserCog, Users, ArrowRight } from "lucide-react"
import { motion, useInView } from "framer-motion"
import { useRef } from "react"

export function QuickAccess({ onLogin, onRegister }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })

    const userTypes = [
        {
            icon: Building2,
            title: "Office Owner",
            description: "Manage staff, monitor queues, and analyze performance.",
            cta: "Owner Login",
            role: "office_owner", // Changed from href
            signupRole: "office_owner", // Changed from signupHref
            showSignup: true,
            color: "bg-blue-500/10 text-blue-600",
            hoverColor: "group-hover:bg-blue-500 group-hover:text-white",
        },
        {
            icon: UserCog,
            title: "Staff Member",
            description: "Access your counter and manage daily operations.",
            cta: "Staff Login",
            role: "staff", // Changed from href
            note: "Contact your manager for credentials",
            showSignup: false,
            color: "bg-amber-500/10 text-amber-600",
            hoverColor: "group-hover:bg-amber-500 group-hover:text-white",
        },
        {
            icon: Users,
            title: "Customer",
            description: "Join queues and experience smoother services.",
            cta: "Customer Login",
            role: "customer", // Changed from href
            signupRole: "customer", // Changed from signupHref
            showSignup: true,
            color: "bg-primary/10 text-primary",
            hoverColor: "group-hover:bg-primary group-hover:text-white",
        },
    ]

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
            },
        },
    }

    const cardVariants = {
        hidden: { opacity: 0, y: 40, scale: 0.95 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 100,
                damping: 15,
            },
        },
    }

    return (
        <section id="quick-access" className="bg-muted/40 px-4 py-20" ref={ref}>
            <div className="container mx-auto max-w-5xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                >
                    <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ duration: 0.3 }}
                        className="inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary mb-4"
                    >
                        Get Started
                    </motion.span>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">Quick Access</h2>
                    <p className="mt-2 text-muted-foreground">Select your role to login or sign up - it's free!</p>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="mt-12 grid gap-6 sm:grid-cols-3"
                >
                    {userTypes.map((type, index) => (
                        <motion.div
                            key={index}
                            variants={cardVariants}
                            whileHover={{ y: -8, transition: { duration: 0.2 } }}
                            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-xl"
                        >
                            <motion.div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                            <div className="relative">
                                <motion.div
                                    whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                                    transition={{ duration: 0.4 }}
                                    className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl ${type.color} ${type.hoverColor} transition-all duration-300`}
                                >
                                    <type.icon className="h-7 w-7" />
                                </motion.div>

                                <h3 className="text-xl font-semibold text-foreground">{type.title}</h3>
                                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{type.description}</p>

                                <div className="mt-6 space-y-3">
                                    <Button
                                        className="w-full shadow-sm hover:opacity-90"
                                        style={{ backgroundColor: 'black', color: 'white', border: '1px solid black' }}
                                        onClick={() => onLogin(type.role)}
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            {type.cta}
                                            <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </Button>

                                    {type.showSignup && (
                                        <Button
                                            variant="ghost"
                                            className="w-full font-medium hover:bg-green-50"
                                            style={{ color: '#16a34a' }}
                                            onClick={() => onRegister(type.signupRole)}
                                        >
                                            Sign up free
                                        </Button>
                                    )}
                                </div>

                                {type.note && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.5 }}
                                        className="mt-3 text-center text-xs text-muted-foreground"
                                    >
                                        {type.note}
                                    </motion.p>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}
