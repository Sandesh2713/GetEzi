import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, ArrowRight, BarChart3, Users, Settings, Building2, Sparkles, Leaf } from "lucide-react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { useAuth } from "../../AuthContext"

export function OwnerLoginView({ onSuccess, onBack, onForgotPass, onSignup }) {
    const { login } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [focusedField, setFocusedField] = useState(null)
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
        { icon: BarChart3, text: "Real-time Analytics" },
        { icon: Users, text: "Team Management" },
        { icon: Settings, text: "Full Control" },
    ]

    return (
        <div className="fixed inset-0 z-50 w-screen h-screen flex overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
            {/* Branding - Top Left */}
            <div className="absolute top-8 left-8 z-50">
                <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
                    <span className="text-3xl font-bold tracking-tight text-emerald-900 lg:text-white">GetEzi</span>
                    <Leaf className="h-8 w-8 text-emerald-600 lg:text-emerald-300" />
                </div>
            </div>
            {/* Animated Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        x: [0, 30, 0],
                        y: [0, -20, 0],
                    }}
                    transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl"
                    animate={{
                        scale: [1.2, 1, 1.2],
                        x: [0, -20, 0],
                        y: [0, 30, 0],
                    }}
                    transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-100/20 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 180, 360],
                    }}
                    transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                />

                {/* Floating Particles */}
                {[...Array(15)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-emerald-400/20 rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                            y: [0, -30, 0],
                            opacity: [0.2, 0.6, 0.2],
                            scale: [1, 1.5, 1],
                        }}
                        transition={{
                            duration: 3 + Math.random() * 2,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: Math.random() * 2,
                        }}
                    />
                ))}
            </div>

            {/* Left Panel - Branding */}
            <motion.div
                className="hidden lg:flex lg:w-1/2 relative flex-col justify-center items-center p-12 bg-gradient-to-br from-emerald-600 to-teal-700"
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                        }}
                    />
                </div>

                <div className="relative z-10 text-center max-w-md">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                        className="mb-8"
                    >
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-6">
                            <Building2 className="w-10 h-10 text-white" />
                        </div>
                    </motion.div>

                    <motion.h1
                        className="text-4xl font-bold text-white mb-4"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                    >
                        Owner Portal
                    </motion.h1>

                    <motion.p
                        className="text-emerald-100 text-lg mb-10 leading-relaxed"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        Take full control of your business. Monitor performance, manage your team, and optimize operations.
                    </motion.p>

                    {/* Feature List */}
                    <div className="space-y-4">
                        {features.map((feature, index) => (
                            <motion.div
                                key={feature.text}
                                className="flex items-center gap-4 text-white/90 bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4"
                                initial={{ x: -50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.2 + index * 0.1 }}
                                whileHover={{ x: 10, backgroundColor: "rgba(255,255,255,0.15)" }}
                            >
                                <motion.div
                                    className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center"
                                    whileHover={{ rotate: 360 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <feature.icon className="w-5 h-5" />
                                </motion.div>
                                <span className="font-medium">{feature.text}</span>
                            </motion.div>
                        ))}
                    </div>

                    {/* Stats Preview */}
                    <motion.div
                        className="mt-10 grid grid-cols-3 gap-4"
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1 }}
                    >
                        {[
                            { value: "50+", label: "Counters" },
                            { value: "99%", label: "Uptime" },
                            { value: "24/7", label: "Support" },
                        ].map((stat, index) => (
                            <motion.div key={stat.label} className="text-center" whileHover={{ scale: 1.05 }}>
                                <div className="text-2xl font-bold text-white">{stat.value}</div>
                                <div className="text-emerald-200 text-sm">{stat.label}</div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>

                {/* Decorative Elements */}
                <motion.div
                    className="absolute bottom-10 left-10 w-20 h-20 border-2 border-white/20 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                />
                <motion.div
                    className="absolute top-20 right-20 w-32 h-32 border-2 border-white/10 rounded-full"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                />
            </motion.div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative z-10">
                <motion.div
                    className="w-full max-w-md"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    {/* Mobile Logo */}
                    <motion.div
                        className="lg:hidden text-center mb-8"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div onClick={onBack} className="inline-flex items-center gap-2 cursor-pointer">
                            <span className="text-2xl font-bold text-emerald-600">GetEzi</span>
                            <span className="text-2xl">🌱</span>
                        </div>
                    </motion.div>

                    {/* Login Card */}
                    <motion.div
                        className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-emerald-500/10 p-8 lg:p-10 border border-white/50"
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
                    >
                        {/* Header */}
                        <div className="text-center mb-8">
                            <motion.div
                                className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-sm font-medium mb-4"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.4, type: "spring" }}
                            >
                                <Sparkles className="w-4 h-4" />
                                Owner Access
                            </motion.div>
                            <motion.h2
                                className="text-3xl font-bold text-gray-900 mb-2"
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                Welcome Back
                            </motion.h2>
                            <motion.p
                                className="text-gray-500"
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                Access your business dashboard
                            </motion.p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                <div className="relative group">
                                    <Mail
                                        className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === "email" ? "text-emerald-500" : "text-gray-400"
                                            }`}
                                    />
                                    <Input
                                        type="email"
                                        placeholder="owner@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onFocus={() => setFocusedField("email")}
                                        onBlur={() => setFocusedField(null)}
                                        className="pl-12 h-14 bg-gray-50/50 border-gray-200 rounded-xl text-base transition-all duration-300 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                        required
                                    />
                                    <motion.div
                                        className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 rounded-full"
                                        initial={{ width: "0%" }}
                                        animate={{ width: focusedField === "email" ? "100%" : "0%" }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                            </motion.div>

                            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.8 }}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                                <div className="relative group">
                                    <Lock
                                        className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === "password" ? "text-emerald-500" : "text-gray-400"
                                            }`}
                                    />
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setFocusedField("password")}
                                        onBlur={() => setFocusedField(null)}
                                        className="pl-12 pr-12 h-14 bg-gray-50/50 border-gray-200 rounded-xl text-base transition-all duration-300 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 transition-colors"
                                    >
                                        <motion.div whileTap={{ scale: 0.9 }}>
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </motion.div>
                                    </button>
                                    <motion.div
                                        className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 rounded-full"
                                        initial={{ width: "0%" }}
                                        animate={{ width: focusedField === "password" ? "100%" : "0%" }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                className="flex justify-end"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.9 }}
                            >
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); onForgotPass(); }}
                                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline transition-colors"
                                >
                                    Forgot Password?
                                </a>
                            </motion.div>

                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1 }}>
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    style={{ background: 'linear-gradient(to right, #10b981, #0f766e)', color: 'white' }}
                                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <motion.div
                                            className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                                        />
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            Login to Dashboard
                                            <motion.span
                                                animate={{ x: [0, 5, 0] }}
                                                transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                                            >
                                                <ArrowRight className="w-5 h-5" />
                                            </motion.span>
                                        </span>
                                    )}
                                </Button>
                            </motion.div>
                        </form>

                        {/* Footer */}
                        <motion.div
                            className="mt-8 text-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.1 }}
                        >
                            <p className="text-gray-500">
                                {"Don't have an account? "}
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); onSignup(); }}
                                    className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors"
                                >
                                    Sign up
                                </a>
                            </p>
                        </motion.div>
                    </motion.div>

                    {/* Trust Indicators */}
                    <motion.div
                        className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-400"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 }}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <span>SSL Secured</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <span>100% Free</span>
                        </div>
                    </motion.div>

                    {/* Back to Home */}
                    <motion.div
                        className="mt-6 text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.3 }}
                    >
                        <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); onBack(); }}
                            className="text-gray-400 hover:text-emerald-600 text-sm transition-colors inline-flex items-center gap-1"
                        >
                            <ArrowRight className="w-4 h-4 rotate-180" />
                            Back to home
                        </a>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    )
}
