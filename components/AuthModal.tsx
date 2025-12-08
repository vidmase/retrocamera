import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showEmailConfirm, setShowEmailConfirm] = useState(false);

    if (!isOpen) return null;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                // Validate name fields
                if (!firstName.trim() || !lastName.trim()) {
                    setError('Please enter both first name and last name');
                    setLoading(false);
                    return;
                }

                // Sign up user with metadata
                const { data: authData, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            full_name: `${firstName.trim()} ${lastName.trim()}`,
                        }
                    }
                });
                
                if (signUpError) throw signUpError;

                // Create profile if user was created (trigger will also try, but this ensures it happens)
                if (authData.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: authData.user.id,
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            full_name: `${firstName.trim()} ${lastName.trim()}`,
                        }, {
                            onConflict: 'id'
                        });

                    if (profileError) {
                        console.error('Error creating profile:', profileError);
                        // Don't throw - user is created, trigger or retry can handle it
                    }
                }

                // Show custom confirmation modal
                setShowEmailConfirm(true);
                // Reset form
                setEmail('');
                setPassword('');
                setFirstName('');
                setLastName('');
                setIsSignUp(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onLoginSuccess();
                onClose();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#f0f0f0] w-full max-w-md p-8 rounded-sm shadow-2xl relative border-4 border-white outline outline-1 outline-gray-300">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                >
                    <i className="fas fa-times text-xl"></i>
                </button>

                {/* Retro Header */}
                <div className="text-center mb-6 border-b-2 border-gray-300 pb-4">
                    <h2 className="font-mono text-2xl text-gray-800 tracking-widest uppercase font-bold">
                        {isSignUp ? 'Join the Club' : 'Member Access'}
                    </h2>
                    <p className="font-hand text-gray-500 text-lg mt-1">
                        {isSignUp ? 'Start your retro journey' : 'Welcome back, photographer'}
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 font-mono text-xs">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="flex flex-col gap-4">
                    {isSignUp && (
                        <>
                            <div>
                                <label className="block text-gray-600 font-mono text-xs uppercase tracking-wider mb-1">First Name</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full bg-white border-2 border-gray-300 p-2 font-mono text-gray-800 focus:outline-none focus:border-accent transition-colors"
                                    placeholder="John"
                                    required={isSignUp}
                                />
                            </div>
                            <div>
                                <label className="block text-gray-600 font-mono text-xs uppercase tracking-wider mb-1">Last Name</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full bg-white border-2 border-gray-300 p-2 font-mono text-gray-800 focus:outline-none focus:border-accent transition-colors"
                                    placeholder="Doe"
                                    required={isSignUp}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-gray-600 font-mono text-xs uppercase tracking-wider mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white border-2 border-gray-300 p-2 font-mono text-gray-800 focus:outline-none focus:border-accent transition-colors"
                            placeholder="user@retro.cam"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-600 font-mono text-xs uppercase tracking-wider mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white border-2 border-gray-300 p-2 font-mono text-gray-800 focus:outline-none focus:border-accent transition-colors"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-4 bg-gray-800 text-white font-mono uppercase tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Login')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                            // Clear form when switching
                            if (!isSignUp) {
                                setFirstName('');
                                setLastName('');
                            }
                        }}
                        className="text-gray-500 hover:text-accent font-mono text-xs underline underline-offset-4"
                    >
                        {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
                    </button>
                </div>

                {/* Decorative Elements */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-6 bg-yellow-100/50 border border-yellow-200/50 transform -rotate-1 pointer-events-none" />
            </div>

            {/* Email Confirmation Modal */}
            {showEmailConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#f0f0f0] w-full max-w-sm p-8 rounded-sm shadow-2xl relative border-4 border-white outline outline-2 outline-gray-400 transform animate-scale-in">
                        {/* Polaroid-style corners */}
                        <div className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
                        <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
                        <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />

                        {/* Mail Icon */}
                        <div className="text-center mb-4">
                            <i className="fas fa-envelope-open-text text-5xl text-accent drop-shadow-lg animate-pulse" />
                        </div>

                        {/* Message */}
                        <div className="text-center mb-6">
                            <h2 className="font-fredericka text-2xl text-gray-800 tracking-widest mb-2">
                                Almost There! ✉️
                            </h2>
                            <p className="font-mono text-sm text-gray-600 leading-relaxed">
                                Check your email for<br />
                                the confirmation link!
                            </p>
                        </div>

                        {/* Button */}
                        <button
                            onClick={() => {
                                setShowEmailConfirm(false);
                                onClose();
                            }}
                            className="w-full bg-accent hover:bg-accent/90 text-white font-mono uppercase tracking-widest py-3 px-4 transition-all transform hover:scale-105 active:scale-95 shadow-lg border-2 border-accent/80"
                        >
                            Got It!
                        </button>

                        {/* Decorative tape */}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-yellow-200/80 border border-yellow-300 transform -rotate-1 pointer-events-none shadow-md" />
                        <div className="absolute -bottom-4 right-1/4 w-16 h-6 bg-yellow-200/80 border border-yellow-300 transform rotate-1 pointer-events-none shadow-md" />
                    </div>
                </div>
            )}
        </div>
    );
};
