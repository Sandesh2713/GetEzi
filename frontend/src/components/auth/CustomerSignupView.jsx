import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, User, Phone, Calendar, ChevronLeft, Loader2, Users, Zap, CheckCircle2 } from "lucide-react"
import { useAuth } from "../../AuthContext"

export function CustomerSignupView({ onSuccess, onSwitch, onBack }) {
    const { register } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [focusedField, setFocusedField] = useState(null)
    const [error, setError] = useState("")

    // Form State
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [phone, setPhone] = useState("")
    const [dob, setDob] = useState("")
    const [gender, setGender] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")
        try {
            // Register as 'customer'
            await register(name, email, password, phone, 'customer', undefined, dob, gender, null)
            onSuccess()
        } catch (err) {
            setError(err.message || "Registration failed")
        } finally {
            setIsLoading(false)
        }
    }

    const features = [
        { icon: User, text: "Personalized Profile" },
        { icon: Zap, text: "Priority Access" },
        { icon: CheckCircle2, text: "Track History" },
    ]

    return (
        <div className="fixed inset-0 z-50 w-screen h-screen flex overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {/* Animated Background Elements (Slightly different colors for Register) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute -top-40 -right-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl"
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.5, 0.3, 0.5],
                    }}
                    transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                {/* Floating particles */}
                {[...Array(10)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-purple-400/20 rounded-full"
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
                <div className="flex items-center gap-3 mb-8">
                    <motion.div
                        className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25"
                        whileHover={{ scale: 1.05, rotate: 5 }}
                    >
                        <Users className="w-6 h-6 text-white" />
                    </motion.div>
                    <span className="text-2xl font-bold text-slate-800">
                        GetEzi <span className="text-indigo-500">Join</span>
                    </span>
                </div>

                <h1 className="text-4xl xl:text-5xl font-bold text-slate-800 leading-tight mb-6">
                    Start Your
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">
                        Queue-Free Journey
                    </span>
                </h1>

                <p className="text-lg text-slate-600 mb-10 leading-relaxed">
                    Create an account to book spots, track live status, and manage your visits effortlessly.
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
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <feature.icon className="w-5 h-5 text-indigo-600" />
                            </div>
                            <span className="text-slate-700 font-medium">{feature.text}</span>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Right Side - Registration Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10 overflow-y-auto">
                <motion.div
                    className="w-full max-w-md my-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    {/* Mobile Back Link */}
                    <div
                        onClick={onBack}
                        className="lg:hidden flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-colors mb-6 cursor-pointer"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="font-medium">Back</span>
                    </div>

                    <motion.div
                        className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-500/10 p-8 border border-white/50"
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        {/* Header */}
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold text-slate-800 mb-2">Create Account</h1>
                            <p className="text-slate-500 text-sm">Join thousands skipping the line</p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Full Name */}
                            <div className="relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${focusedField === 'name' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                    <User className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                    onFocus={() => setFocusedField("name")}
                                    onBlur={() => setFocusedField(null)}
                                    required
                                />
                            </div>

                            {/* Email */}
                            <div className="relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${focusedField === 'email' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                    onFocus={() => setFocusedField("email")}
                                    onBlur={() => setFocusedField(null)}
                                    required
                                />
                            </div>

                            {/* Password */}
                            <div className="relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${focusedField === 'password' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3 bg-slate-50/50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                    onFocus={() => setFocusedField("password")}
                                    onBlur={() => setFocusedField(null)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                            {/* Phone */}
                            <div className="relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${focusedField === 'phone' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                    <Phone className="w-5 h-5" />
                                </div>
                                <input
                                    type="tel"
                                    placeholder="Phone (Optional)"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                    onFocus={() => setFocusedField("phone")}
                                    onBlur={() => setFocusedField(null)}
                                />
                            </div>

                            {/* DOB and Gender Row */}
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${focusedField === 'dob' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="date"
                                        value={dob}
                                        onChange={(e) => setDob(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                        onFocus={() => setFocusedField("dob")}
                                        onBlur={() => setFocusedField(null)}
                                        required
                                        style={{ color: dob ? 'inherit' : '#94a3b8' }}
                                    />
                                </div>
                                <div className="relative w-1/3">
                                    <select
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50/50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none transition-all appearance-none"
                                        required
                                        style={{ color: gender ? 'inherit' : '#94a3b8' }}
                                    >
                                        <option value="" disabled>Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        ▼
                                    </div>
                                </div>
                            </div>

                            <motion.button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 disabled:opacity-70 transition-all duration-300 group relative overflow-hidden mt-2"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <span className="relative flex items-center justify-center gap-2">
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            creating account...
                                        </>
                                    ) : (
                                        <>
                                            Create Account
                                            <Zap className="w-5 h-5" />
                                        </>
                                    )}
                                </span>
                            </motion.button>
                        </form>

                        <div className="text-center mt-6 text-slate-600">
                            Already have an account?{" "}
                            <button
                                onClick={onSwitch}
                                className="text-indigo-600 hover:text-indigo-700 font-semibold hover:underline transition-colors"
                            >
                                Login
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    )
}
