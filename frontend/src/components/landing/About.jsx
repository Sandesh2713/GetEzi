
import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { CheckCircle2 } from "lucide-react"

export function About() {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })

    return (
        <section id="about" className="py-24 bg-muted/30" ref={ref}>
            <div className="container mx-auto px-4 max-w-6xl">
                <div className="max-w-3xl mx-auto">
                    {/* Text Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.6 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-6"
                        >
                            <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
                            About Us
                        </motion.div>

                        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-6">
                            Revolutionizing how the world waits.
                        </h2>

                        <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                            GetEzi was born from a simple observation: time is our most valuable resource, yet we spend too much of it waiting in lines.
                        </p>

                        <p className="text-muted-foreground mb-8 leading-relaxed">
                            We built a platform that empowers businesses to manage patient and customer flows efficiently, while giving people their time back.
                            Whether you run a clinic, a government office, or a retail store, GetEzi simplifies the chaos of queues into a smooth, digital experience.
                        </p>

                        <div className="space-y-4">
                            {[
                                "Smart virtual queuing algorithms",
                                "Real-time status updates via SMS/Web",
                                "Analytics to optimize staff performance",
                                "Completely free for standard use"
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                                    transition={{ delay: 0.3 + (i * 0.1) }}
                                    className="flex items-center gap-3"
                                >
                                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                    <span className="text-foreground">{item}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
