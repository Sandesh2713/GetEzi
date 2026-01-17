
import { BarChart3, Clock, Users, Zap, Shield, Smartphone } from "lucide-react"
import { motion, useInView } from "framer-motion"
import { useRef } from "react"

export function Features() {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })

    const features = [
        {
            icon: Clock,
            title: "Real-time Queue Updates",
            description: "Keep customers informed with live queue status and estimated wait times.",
        },
        {
            icon: BarChart3,
            title: "Advanced Analytics",
            description: "Gain insights into peak hours, staff performance, and customer patterns.",
        },
        {
            icon: Users,
            title: "Multi-counter Support",
            description: "Manage multiple service counters and staff assignments effortlessly.",
        },
        {
            icon: Zap,
            title: "Instant Notifications",
            description: "Send SMS and push notifications to keep customers in the loop.",
        },
        {
            icon: Shield,
            title: "Secure & Reliable",
            description: "Enterprise-grade security with 99.9% uptime guarantee.",
        },
        {
            icon: Smartphone,
            title: "Mobile First",
            description: "Works seamlessly on any device - desktop, tablet, or smartphone.",
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

    const cardVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 100,
                damping: 12,
            },
        },
    }

    return (
        <section id="features" className="px-4 py-24" ref={ref}>
            <div className="container mx-auto max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                >
                    <motion.p
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isInView ? { opacity: 1, scale: 1 } : {}}
                        className="text-sm font-semibold uppercase tracking-wider text-primary"
                    >
                        Features
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.1 }}
                        className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl"
                    >
                        Everything you need to manage queues
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.2 }}
                        className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground"
                    >
                        Powerful tools designed to streamline your operations and enhance customer experience.
                    </motion.p>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
                >
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            variants={cardVariants}
                            whileHover={{
                                y: -8,
                                scale: 1.02,
                                transition: { duration: 0.2 },
                            }}
                            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-xl"
                        >
                            <motion.div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative">
                                <motion.div
                                    whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                                    transition={{ duration: 0.4 }}
                                    className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white"
                                >
                                    <feature.icon className="h-6 w-6" />
                                </motion.div>

                                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                                <p className="mt-2 leading-relaxed text-muted-foreground">{feature.description}</p>

                                <motion.div
                                    className="absolute bottom-0 left-0 h-1 bg-primary rounded-full"
                                    initial={{ width: 0 }}
                                    whileHover={{ width: "100%" }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}
