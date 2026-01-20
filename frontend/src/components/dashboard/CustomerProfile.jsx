import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Calendar, MapPin, Heart, Droplet, AlertCircle, Save, Edit2, Upload, Camera, ChevronLeft, ArrowLeft } from 'lucide-react';

export default function CustomerProfile({ user, onBack }) { // Added onBack prop
    const [isEditing, setIsEditing] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [formData, setFormData] = useState({
        fullName: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        dateOfBirth: user?.dateOfBirth || '',
        age: user?.age || '',
        gender: user?.gender || '',
        bloodType: user?.bloodType || '',
        address: user?.address || '',
        city: user?.city || '',
        state: user?.state || '',
        zipCode: user?.zipCode || '',
        emergencyContactName: user?.emergencyContactName || '',
        emergencyContactPhone: user?.emergencyContactPhone || '',
        allergies: user?.allergies || '',
        medicalNotes: user?.medicalNotes || '',
    });

    const [editData, setEditData] = useState(formData);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    const handleInputChange = (field, value) => {
        setEditData({
            ...editData,
            [field]: value,
        });
    };

    const handleSaveChanges = () => {
        setFormData(editData);
        setIsEditing(false);
    };

    const calculateAge = (dateString) => {
        if (!dateString) return '--';
        const today = new Date();
        const birthDate = new Date(dateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setProfileImage(event.target?.result);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
            {/* Floating Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute top-20 right-10 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-20"
                    animate={{ y: [0, 50, 0], x: [0, 30, 0] }}
                    transition={{ duration: 8, repeat: Infinity }}
                />
                <motion.div
                    className="absolute bottom-32 left-10 w-80 h-80 bg-cyan-200 rounded-full blur-3xl opacity-20"
                    animate={{ y: [0, -50, 0], x: [0, -30, 0] }}
                    transition={{ duration: 10, repeat: Infinity }}
                />
            </div>

            {/* Header */}
            <motion.div
                className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200"
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                                <ArrowLeft size={24} />
                            </button>
                        )}
                        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
                    </div>
                    <motion.button
                        onClick={() => setIsEditing(!isEditing)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Edit2 size={18} />
                        {isEditing ? 'Cancel' : 'Edit Profile'}
                    </motion.button>
                </div>
            </motion.div>

            {/* Main Content */}
            <motion.main
                className="relative z-10 max-w-4xl mx-auto px-6 py-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Profile Header Card */}
                <motion.div
                    className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mb-8"
                    variants={itemVariants}
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                        {/* Avatar Section */}
                        <motion.div
                            className="flex flex-col items-center"
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="relative">
                                {profileImage ? (
                                    <img
                                        src={profileImage || "/placeholder.svg"}
                                        alt="Profile"
                                        className="w-32 h-32 rounded-full object-cover border-4 border-blue-500 shadow-lg"
                                    />
                                ) : (
                                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center shadow-lg border-4 border-blue-500">
                                        <User size={64} className="text-white" />
                                    </div>
                                )}
                                {isEditing && (
                                    <label className="absolute bottom-0 right-0 p-3 bg-blue-600 rounded-full cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                                        <Camera size={20} className="text-white" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                            {isEditing && (
                                <motion.p
                                    className="text-xs text-gray-500 mt-2 text-center"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    Click the camera icon to upload a photo
                                </motion.p>
                            )}
                        </motion.div>

                        {/* Basic Info */}
                        <div className="flex-1">
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={editData.fullName}
                                            onChange={(e) => handleInputChange('fullName', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h2 className="text-4xl font-bold text-gray-900">{formData.fullName}</h2>
                                    <p className="text-gray-500 mt-1">Premium Member</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Contact Information */}
                <motion.div
                    className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mb-8"
                    variants={itemVariants}
                >
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Mail className="text-blue-600" size={28} />
                        Contact Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Email Address
                            </label>
                            {isEditing ? (
                                <input
                                    type="email"
                                    value={editData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                />
                            ) : (
                                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
                                    <Mail size={20} className="text-blue-600" />
                                    <span className="text-gray-900">{formData.email}</span>
                                </div>
                            )}
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Phone Number
                            </label>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    value={editData.phone}
                                    onChange={(e) => handleInputChange('phone', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                />
                            ) : (
                                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
                                    <Phone size={20} className="text-blue-600" />
                                    <span className="text-gray-900">{formData.phone}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Personal Information */}
                <motion.div
                    className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mb-8"
                    variants={itemVariants}
                >
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <User className="text-blue-600" size={28} />
                        Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Date of Birth */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Date of Birth
                            </label>
                            {isEditing ? (
                                <input
                                    type="date"
                                    value={editData.dateOfBirth}
                                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                />
                            ) : (
                                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
                                    <Calendar size={20} className="text-blue-600" />
                                    <span className="text-gray-900">{new Date(formData.dateOfBirth).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Age */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Age
                            </label>
                            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                                <span className="text-2xl font-bold text-blue-600">
                                    {isEditing ? editData.age : calculateAge(formData.dateOfBirth)}
                                </span>
                                <span className="text-gray-600">years old</span>
                            </div>
                        </div>

                        {/* Gender */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Gender
                            </label>
                            {isEditing ? (
                                <select
                                    value={editData.gender}
                                    onChange={(e) => handleInputChange('gender', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                >
                                    <option>Male</option>
                                    <option>Female</option>
                                    <option>Other</option>
                                </select>
                            ) : (
                                <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                                    {formData.gender}
                                </div>
                            )}
                        </div>

                        {/* Blood Type */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Blood Type
                            </label>
                            {isEditing ? (
                                <select
                                    value={editData.bloodType}
                                    onChange={(e) => handleInputChange('bloodType', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                >
                                    <option>A+</option>
                                    <option>A-</option>
                                    <option>B+</option>
                                    <option>B-</option>
                                    <option>AB+</option>
                                    <option>AB-</option>
                                    <option>O+</option>
                                    <option>O-</option>
                                </select>
                            ) : (
                                <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-100">
                                    <Droplet size={20} className="text-red-600" />
                                    <span className="text-gray-900 font-semibold">{formData.bloodType}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Address Information */}
                <motion.div
                    className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mb-8"
                    variants={itemVariants}
                >
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <MapPin className="text-blue-600" size={28} />
                        Address Information
                    </h3>
                    <div className="space-y-6">
                        {/* Full Address */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Full Address
                            </label>
                            {isEditing ? (
                                <textarea
                                    value={editData.address}
                                    onChange={(e) => handleInputChange('address', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
                                    rows={3}
                                />
                            ) : (
                                <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                    {formData.address}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* City */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    City
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.city}
                                        onChange={(e) => handleInputChange('city', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    />
                                ) : (
                                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                        {formData.city}
                                    </div>
                                )}
                            </div>

                            {/* State */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    State
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.state}
                                        onChange={(e) => handleInputChange('state', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    />
                                ) : (
                                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                        {formData.state}
                                    </div>
                                )}
                            </div>

                            {/* Zip Code */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Zip Code
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editData.zipCode}
                                        onChange={(e) => handleInputChange('zipCode', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    />
                                ) : (
                                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                        {formData.zipCode}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Emergency Contact */}
                <motion.div
                    className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mb-8"
                    variants={itemVariants}
                >
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Heart className="text-red-600" size={28} />
                        Emergency Contact
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Emergency Contact Name */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Contact Name
                            </label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editData.emergencyContactName}
                                    onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                />
                            ) : (
                                <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                    {formData.emergencyContactName}
                                </div>
                            )}
                        </div>

                        {/* Emergency Contact Phone */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Contact Phone
                            </label>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    value={editData.emergencyContactPhone}
                                    onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                />
                            ) : (
                                <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                    {formData.emergencyContactPhone}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Medical Information */}
                <motion.div
                    className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mb-8"
                    variants={itemVariants}
                >
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <AlertCircle className="text-orange-600" size={28} />
                        Medical Information
                    </h3>
                    <div className="space-y-6">
                        {/* Allergies */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Allergies
                            </label>
                            {isEditing ? (
                                <textarea
                                    value={editData.allergies}
                                    onChange={(e) => handleInputChange('allergies', e.target.value)}
                                    placeholder="List any allergies (e.g., Penicillin, Peanuts, etc.)"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
                                    rows={3}
                                />
                            ) : (
                                <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                    {formData.allergies || 'No allergies recorded'}
                                </div>
                            )}
                        </div>

                        {/* Medical Notes */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Medical Notes
                            </label>
                            {isEditing ? (
                                <textarea
                                    value={editData.medicalNotes}
                                    onChange={(e) => handleInputChange('medicalNotes', e.target.value)}
                                    placeholder="Any additional medical information or conditions"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
                                    rows={3}
                                />
                            ) : (
                                <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                    {formData.medicalNotes || 'No medical notes'}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Save Button */}
                {isEditing && (
                    <motion.div
                        className="flex gap-4 mb-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <motion.button
                            onClick={() => setIsEditing(false)}
                            className="flex-1 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            Cancel
                        </motion.button>
                        <motion.button
                            onClick={handleSaveChanges}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Save size={20} />
                            Save Changes
                        </motion.button>
                    </motion.div>
                )}
            </motion.main>
        </div>
    );
}
