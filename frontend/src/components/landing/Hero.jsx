
import { Button } from "../ui/button"
import { ArrowDown, CheckCircle2, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

export function Hero() {
    return (
        <section className="relative overflow-hidden px-4 pt-32 pb-20 md:pt-40 md:pb-28">
            <div className="absolute inset-0 -z-10">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY }}
                    className="absolute top-20 left-1/4 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
                />
                <motion.div
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY }}
                    className="absolute bottom-10 right-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
                />
            </div>

            <div className="container mx-auto max-w-6xl">
                <div className="flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, type: "spring" }}
                        className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
                    >
                        <motion.div
                            animate={{ rotate: [0, 15, -15, 0] }}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                        >
                            <Sparkles className="h-4 w-4" />
                        </motion.div>
                        <span>Free Forever - No Hidden Costs</span>
                    </motion.div>

                    <motion.h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
                        <motion.span
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="block"
                        >
                            Queue management
                        </motion.span>
                        <motion.span
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="block text-primary"
                        >
                            made effortless
                        </motion.span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                        className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl"
                    >
                        Streamline your operations with intelligent queue management. Reduce wait times, boost efficiency, and
                        delight your customers - completely free.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.8 }}
                        className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
                    >
                        <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                            <Button
                                asChild
                                size="lg"
                                className="h-12 bg-foreground px-8 text-background hover:bg-foreground/90 shadow-lg"
                            >
                                <a href="#quick-access">
                                    Get Started Now
                                    <motion.span
                                        animate={{ y: [0, 3, 0] }}
                                        transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                                        className="inline-block"
                                    >
                                        <ArrowDown className="ml-2 h-4 w-4" />
                                    </motion.span>
                                </a>
                            </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button asChild size="lg" variant="outline" className="h-12 bg-transparent px-8">
                                <a href="#features">Learn More</a>
                            </Button>
                        </motion.div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 1 }}
                        className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground"
                    >
                        {["No sign-up fees", "No credit card required", "Free for everyone"].map((text, index) => (
                            <motion.div
                                key={text}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: 1.1 + index * 0.1 }}
                                className="flex items-center gap-2"
                            >
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                <span>{text}</span>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
