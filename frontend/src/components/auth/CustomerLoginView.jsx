import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, Clock, Bell, Smartphone, ChevronLeft, Loader2, Users, Zap } from "lucide-react"
import { useAuth } from "../../AuthContext"

export function CustomerLoginView({ onSuccess, onBack, onForgotPass, onSignup, onQuickJoin }) {
    const { login } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [focusedField, setFocusedField] = useState(null)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
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

    const features = [
        { icon: Clock, text: "Real-time Queue Updates" },
        { icon: Bell, text: "Smart Notifications" },
        { icon: Smartphone, text: "Mobile Check-in" },
    ]

    return (
        <div className="fixed inset-0 z-50 w-screen h-screen flex overflow-hidden bg-gradient-to-br from-sky-50 via-white to-cyan-50">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute -top-40 -right-40 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-200/40 rounded-full blur-3xl"
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.5, 0.3, 0.5],
                    }}
                    transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-100/30 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 180, 360],
                    }}
                    transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                />
                {/* Floating particles */}
                {[...Array(15)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-sky-400/20 rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                            y: [0, -30, 0],
                            opacity: [0.2, 0.6, 0.2],
                        }}
                        transition={{
                            duration: 3 + Math.random() * 2,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: Math.random() * 2,
                        }}
                    />
                ))}
            </div>

            {/* Left Side - Branding */}
            <motion.div
                className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20 relative z-10"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
            >


                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <div className="flex items-center gap-3 mb-8">
                        <motion.div
                            className="w-12 h-12 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/25"
                            whileHover={{ scale: 1.05, rotate: 5 }}
                        >
                            <Users className="w-6 h-6 text-white" />
                        </motion.div>
                        <span className="text-2xl font-bold text-slate-800">
                            GetEzi <span className="text-sky-500">Customer</span>
                        </span>
                    </div>

                    <h1 className="text-4xl xl:text-5xl font-bold text-slate-800 leading-tight mb-6">
                        Skip the Wait,
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-500">
                            Not the Service
                        </span>
                    </h1>

                    <p className="text-lg text-slate-600 mb-10 leading-relaxed">
                        Join your queue remotely and get notified when it's your turn. No more waiting in long lines.
                    </p>

                    <div className="space-y-4">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                className="flex items-center gap-4"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + index * 0.1 }}
                                whileHover={{ x: 8 }}
                            >
                                <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                                    <feature.icon className="w-5 h-5 text-sky-600" />
                                </div>
                                <span className="text-slate-700 font-medium">{feature.text}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>


            </motion.div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
                <motion.div
                    className="w-full max-w-md"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    {/* Mobile Back Link */}
                    <div
                        onClick={onBack}
                        className="lg:hidden flex items-center gap-2 text-slate-600 hover:text-sky-600 transition-colors mb-8 cursor-pointer"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="font-medium">Back to Home</span>
                    </div>

                    <motion.div
                        className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-sky-500/10 p-8 sm:p-10 border border-white/50"
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        {/* Header */}
                        <motion.div
                            className="text-center mb-8"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <motion.div
                                className="w-16 h-16 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/30"
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                animate={{
                                    boxShadow: [
                                        "0 10px 40px -10px rgba(14, 165, 233, 0.3)",
                                        "0 10px 40px -10px rgba(14, 165, 233, 0.5)",
                                        "0 10px 40px -10px rgba(14, 165, 233, 0.3)",
                                    ],
                                }}
                                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                            >
                                <Users className="w-8 h-8 text-white" />
                            </motion.div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
                            <p className="text-slate-500">Sign in to check your queue status</p>
                        </motion.div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email Field */}
                            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                                <div className="relative">
                                    <motion.div
                                        className="absolute left-4 top-1/2 -translate-y-1/2"
                                        animate={{ color: focusedField === "email" ? "#0ea5e9" : "#94a3b8" }}
                                    >
                                        <Mail className="w-5 h-5" />
                                    </motion.div>
                                    <input
                                        type="email"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-2 border-slate-200 rounded-xl focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10 outline-none transition-all duration-300"
                                        onFocus={() => setFocusedField("email")}
                                        onBlur={() => setFocusedField(null)}
                                        required
                                    />
                                </div>
                            </motion.div>

                            {/* Password Field */}
                            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                                <div className="relative">
                                    <motion.div
                                        className="absolute left-4 top-1/2 -translate-y-1/2"
                                        animate={{ color: focusedField === "password" ? "#0ea5e9" : "#94a3b8" }}
                                    >
                                        <Lock className="w-5 h-5" />
                                    </motion.div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-12 py-3.5 bg-slate-50/50 border-2 border-slate-200 rounded-xl focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10 outline-none transition-all duration-300"
                                        onFocus={() => setFocusedField("password")}
                                        onBlur={() => setFocusedField(null)}
                                        required
                                    />
                                    <motion.button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500 transition-colors"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </motion.button>
                                </div>
                            </motion.div>

                            {/* Forgot Password */}
                            <motion.div
                                className="text-right"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.7 }}
                            >
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); onForgotPass(); }}
                                    className="text-sm text-sky-600 hover:text-sky-700 font-medium hover:underline transition-colors"
                                >
                                    Forgot Password?
                                </a>
                            </motion.div>

                            {/* Submit Button */}
                            <motion.button
                                type="submit"
                                disabled={isLoading}
                                style={{ background: 'linear-gradient(to right, #0ea5e9, #06b6d4)', color: 'white' }}
                                className="w-full py-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/40 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 relative overflow-hidden group"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <motion.div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-sky-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <span className="relative flex items-center justify-center gap-2">
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Signing in...
                                        </>
                                    ) : (
                                        <>
                                            Sign In
                                            <Zap className="w-5 h-5" />
                                        </>
                                    )}
                                </span>
                            </motion.button>
                        </form>

                        {/* Sign Up Link */}
                        <motion.p
                            className="text-center mt-8 text-slate-600"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.9 }}
                        >
                            {"Don't have an account? "}
                            <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); onSignup(); }}
                                className="text-sky-600 hover:text-sky-700 font-semibold hover:underline transition-colors"
                            >
                                Sign up free
                            </a>
                        </motion.p>

                        {/* Quick Join Option */}
                        <motion.div
                            className="mt-6 pt-6 border-t border-slate-200"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                        >
                            <p className="text-center text-sm text-slate-500 mb-4">Or join a queue without an account</p>
                            <div
                                onClick={onQuickJoin}
                                className="cursor-pointer w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-center transition-colors"
                            >
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Quick Join with Code
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Trust Indicators */}
                    <motion.div
                        className="flex items-center justify-center gap-6 mt-8 text-sm text-slate-500"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.1 }}
                    >
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-sky-500" />
                            <span>Real-time updates</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-sky-500" />
                            <span>SMS alerts</span>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    )
}
