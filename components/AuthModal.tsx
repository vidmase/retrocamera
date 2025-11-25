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
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                alert('Check your email for the confirmation link!');
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
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-gray-500 hover:text-accent font-mono text-xs underline underline-offset-4"
                    >
                        {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
                    </button>
                </div>

                {/* Decorative Elements */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-6 bg-yellow-100/50 border border-yellow-200/50 transform -rotate-1 pointer-events-none" />
            </div>
        </div>
    );
};
