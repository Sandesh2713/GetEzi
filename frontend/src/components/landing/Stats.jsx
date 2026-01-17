
import { motion, useInView } from "framer-motion"
import { useRef, useEffect, useState } from "react"

function AnimatedCounter({ value, suffix = "" }) {
    const [count, setCount] = useState(0)
    const numericValue = Number.parseInt(value.replace(/\D/g, "")) || 0
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true })

    useEffect(() => {
        if (!isInView) return

        const duration = 2000
        const steps = 60
        const stepValue = numericValue / steps
        let current = 0

        const timer = setInterval(() => {
            current += stepValue
            if (current >= numericValue) {
                setCount(numericValue)
                clearInterval(timer)
            } else {
                setCount(Math.floor(current))
            }
        }, duration / steps)

        return () => clearInterval(timer)
    }, [isInView, numericValue])

    const displayValue = value.includes("+")
        ? `${count}+`
        : value.includes("%")
            ? `${count}%`
            : value.includes("x")
                ? `${count}x`
                : count.toString()

    return <span ref={ref}>{displayValue}</span>
}

export function Stats() {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })

    const stats = [
        { value: "50%", label: "Reduced wait times", company: "Healthcare Clinics" },
        { value: "3x", label: "Faster service", company: "Government Offices" },
        { value: "98%", label: "Customer satisfaction", company: "Retail Stores" },
        { value: "10000+", label: "Queues managed daily", company: "Worldwide" },
    ]

    return (
        <section ref={ref} className="border-y border-border bg-muted/30 px-4 py-20">
            <div className="container mx-auto max-w-6xl">
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5 }}
                    className="mb-10 text-center text-sm font-medium text-muted-foreground"
                >
                    Trusted by businesses worldwide to manage their queues
                </motion.p>

                <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30, scale: 0.9 }}
                            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{ scale: 1.05 }}
                            className="text-center"
                        >
                            <motion.p className="text-4xl font-bold text-foreground md:text-5xl">
                                <AnimatedCounter value={stat.value} />
                            </motion.p>
                            <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={isInView ? { opacity: 1 } : {}}
                                transition={{ delay: 0.5 + index * 0.1 }}
                                className="mt-1 text-xs font-medium text-primary"
                            >
                                {stat.company}
                            </motion.p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
