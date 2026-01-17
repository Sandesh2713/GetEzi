import { useState } from "react"
import { motion } from "framer-motion"
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Users, Sparkles, Leaf } from "lucide-react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { useAuth } from "../../AuthContext"

export function StaffLoginView({ onSuccess, onBack, onForgotPass }) {
    const { login } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")
        try {
            await login(email, password)
            onSuccess()
        } catch (err) {
            setError(err.message || "Login failed")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 w-screen h-screen flex overflow-hidden bg-gradient-to-br from-secondary via-background to-secondary">
            {/* Branding - Top Left */}
            <div className="absolute top-8 left-8 z-50">
                <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
                    <span className="text-xl font-bold tracking-tight text-foreground">GetEzi</span>
                    <Leaf className="h-5 w-5 text-green-600" />
                </div>
            </div>

            {/* BACK BUTTON REMOVED (Replaced by Branding Logic or keep generic back?) 
               User image shows "Back to home" arrow. I will keep the arrow link near the form as per design, 
               but maybe position it better or rely on the logo as home link?
               User said "no branding". So explicit logo is key.
            */}

            {/* Animated background elements */}
            <motion.div
                className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
                animate={{
                    scale: [1, 1.2, 1],
                    x: [0, 30, 0],
                    y: [0, -20, 0],
                }}
                transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
                animate={{
                    scale: [1.2, 1, 1.2],
                    x: [0, -40, 0],
                    y: [0, 30, 0],
                }}
                transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute top-1/2 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl"
                animate={{
                    scale: [1, 1.3, 1],
                    rotate: [0, 180, 360],
                }}
                transition={{ duration: 15, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            />

            {/* Floating particles */}
            {[...Array(6)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-primary/30 rounded-full"
                    style={{
                        left: `${20 + i * 15}%`,
                        top: `${10 + i * 12}%`,
                    }}
                    animate={{
                        y: [0, -30, 0],
                        opacity: [0.3, 0.8, 0.3],
                    }}
                    transition={{
                        duration: 3 + i * 0.5,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: i * 0.3,
                    }}
                />
            ))}

            {/* Left side - Branding (hidden on mobile) */}
            <motion.div
                className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
            >
                <div className="max-w-md text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                        className="mb-8"
                    >
                        <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 relative">
                            <Users className="w-12 h-12 text-primary" />
                            <motion.div
                                className="absolute -top-2 -right-2"
                                animate={{ rotate: [0, 15, -15, 0] }}
                                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                            >
                                <Sparkles className="w-6 h-6 text-primary" />
                            </motion.div>
                        </div>
                    </motion.div>

                    <motion.h1
                        className="text-4xl font-bold text-foreground mb-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        Staff Portal
                    </motion.h1>

                    <motion.p
                        className="text-muted-foreground text-lg mb-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        Access your counter and manage daily operations with ease
                    </motion.p>

                    {/* Feature highlights */}
                    <motion.div
                        className="space-y-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        {["Real-time queue updates", "Customer management", "Performance tracking"].map((feature, index) => (
                            <motion.div
                                key={feature}
                                className="flex items-center gap-3 text-muted-foreground"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.8 + index * 0.1 }}
                            >
                                <div className="w-2 h-2 bg-primary rounded-full" />
                                <span>{feature}</span>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </motion.div>

            {/* Right side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
                <motion.div
                    className="w-full max-w-md"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    {/* Back to home */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                        <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); onBack(); }}
                            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to home
                        </a>
                    </motion.div>

                    {/* Login Card */}
                    <motion.div
                        className="bg-card/80 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-xl border border-border/50"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    >
                        {/* Logo for mobile */}
                        <motion.div
                            className="lg:hidden flex items-center gap-2 justify-center mb-6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-primary" />
                            </div>
                            <span className="text-xl font-bold text-foreground">GetEzi Staff</span>
                        </motion.div>

                        <motion.div
                            className="text-center mb-8"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome Back</h2>
                            <p className="text-muted-foreground">{"Let's get you started"}</p>
                        </motion.div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                                <label className="text-sm font-medium text-foreground mb-2 block">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        type="email"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-12 h-12 bg-secondary/50 border-border/50 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                        required
                                    />
                                </div>
                            </motion.div>

                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                                <label className="text-sm font-medium text-foreground mb-2 block">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-12 pr-12 h-12 bg-secondary/50 border-border/50 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </motion.div>

                            <motion.div
                                className="flex justify-end"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.7 }}
                            >
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); onForgotPass(); }}
                                    className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                                >
                                    Forgot Password?
                                </a>
                            </motion.div>

                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    style={{ backgroundColor: 'black', color: 'white' }}
                                    className="w-full h-12 bg-black hover:bg-zinc-800 text-white rounded-xl font-semibold text-base relative overflow-hidden group shadow-md"
                                >
                                    <motion.span
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                        initial={{ x: "-100%" }}
                                        whileHover={{ x: "100%" }}
                                        transition={{ duration: 0.6 }}
                                    />
                                    {isLoading ? (
                                        <motion.div className="flex items-center gap-2 justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                            <motion.div
                                                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                                            />
                                            Signing in...
                                        </motion.div>
                                    ) : (
                                        "Login"
                                    )}
                                </Button>
                            </motion.div>
                        </form>

                        <motion.div
                            className="mt-8 text-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.9 }}
                        >
                            <p className="text-muted-foreground text-sm">
                                {"Don't have credentials?"} <span className="text-primary font-medium">Contact your manager</span>
                            </p>
                        </motion.div>
                    </motion.div>

                    {/* Trust badges */}
                    <motion.div
                        className="mt-8 flex items-center justify-center gap-6 text-muted-foreground text-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span>Secure Login</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary rounded-full" />
                            <span>256-bit Encryption</span>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    )
}
