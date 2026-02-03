import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseAuth: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
    supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
} else {
    console.warn('⚠️ Supabase credentials not configured. Auth features will use local storage fallback.');
}

export interface UserProfile {
    id: string;
    email: string;
    fullName?: string;
    role?: 'founder' | 'marketing' | 'community' | 'developer';
    avatarUrl?: string;
    walletAddress?: string;
    brandId?: string; // The brand this user owns
    brandName?: string; // Human-readable brand name (e.g., "ENKI Protocol")
    createdAt: number;
    updatedAt: number;
}

export interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const USER_PROFILE_KEY = 'defia_user_profile_v1';
const AUTH_SESSION_KEY = 'defia_auth_session_v1';

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

export const loadUserProfile = (): UserProfile | null => {
    try {
        const stored = localStorage.getItem(USER_PROFILE_KEY);
        if (stored) {
            return JSON.parse(stored) as UserProfile;
        }
    } catch (e) {
        console.warn('Failed to load user profile from storage', e);
    }
    return null;
};

export const saveUserProfile = (profile: UserProfile): void => {
    try {
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
        window.dispatchEvent(new CustomEvent('defia:user-profile-updated', { detail: profile }));
    } catch (e) {
        console.warn('Failed to save user profile', e);
    }
};

const clearAuthData = () => {
    localStorage.removeItem(USER_PROFILE_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
};

// ============================================
// SIGN UP (Email + Password)
// ============================================

export const signUp = async (
    email: string,
    password: string,
    metadata?: { fullName?: string; role?: UserProfile['role'] }
): Promise<{ user: UserProfile | null; error: string | null }> => {

    if (!supabaseAuth) {
        // Fallback: Create local account
        const existingUsers = JSON.parse(localStorage.getItem('defia_local_users') || '{}');

        if (existingUsers[email]) {
            return { user: null, error: 'An account with this email already exists' };
        }

        const profile: UserProfile = {
            id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            email,
            fullName: metadata?.fullName,
            role: metadata?.role,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        // Store user with hashed password (simple hash for local dev)
        existingUsers[email] = {
            profile,
            passwordHash: btoa(password), // Simple encoding for local dev only
        };
        localStorage.setItem('defia_local_users', JSON.stringify(existingUsers));

        saveUserProfile(profile);
        return { user: profile, error: null };
    }

    try {
        const { data, error } = await supabaseAuth.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: metadata?.fullName,
                    role: metadata?.role,
                },
            },
        });

        if (error) {
            return { user: null, error: error.message };
        }

        if (data.user) {
            const profile: UserProfile = {
                id: data.user.id,
                email: data.user.email || email,
                fullName: metadata?.fullName,
                role: metadata?.role,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            saveUserProfile(profile);
            return { user: profile, error: null };
        }

        return { user: null, error: 'Failed to create account' };
    } catch (e: any) {
        console.error('Sign up failed:', e);
        return { user: null, error: e.message || 'Sign up failed' };
    }
};

// ============================================
// SIGN IN (Email + Password)
// ============================================

export const signIn = async (
    email: string,
    password: string
): Promise<{ user: UserProfile | null; error: string | null }> => {

    if (!supabaseAuth) {
        // Fallback: Local authentication
        const existingUsers = JSON.parse(localStorage.getItem('defia_local_users') || '{}');
        const userRecord = existingUsers[email];

        if (!userRecord) {
            return { user: null, error: 'No account found with this email' };
        }

        if (userRecord.passwordHash !== btoa(password)) {
            return { user: null, error: 'Invalid password' };
        }

        saveUserProfile(userRecord.profile);
        return { user: userRecord.profile, error: null };
    }

    try {
        const { data, error } = await supabaseAuth.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return { user: null, error: error.message };
        }

        if (data.user) {
            // Fetch or create profile
            const profile: UserProfile = {
                id: data.user.id,
                email: data.user.email || email,
                fullName: data.user.user_metadata?.full_name,
                role: data.user.user_metadata?.role,
                brandId: data.user.user_metadata?.brand_id,
                brandName: data.user.user_metadata?.brand_name,
                createdAt: new Date(data.user.created_at).getTime(),
                updatedAt: Date.now(),
            };
            saveUserProfile(profile);
            return { user: profile, error: null };
        }

        return { user: null, error: 'Sign in failed' };
    } catch (e: any) {
        console.error('Sign in failed:', e);
        return { user: null, error: e.message || 'Sign in failed' };
    }
};

// ============================================
// SIGN OUT
// ============================================

export const signOut = async (): Promise<void> => {
    clearAuthData();

    if (supabaseAuth) {
        await supabaseAuth.auth.signOut();
    }

    window.dispatchEvent(new CustomEvent('defia:user-signed-out'));
    window.location.href = '/';
};

// ============================================
// GET CURRENT USER
// ============================================

export const getCurrentUser = async (): Promise<UserProfile | null> => {
    // First check local profile
    const localProfile = loadUserProfile();

    if (!supabaseAuth) {
        return localProfile;
    }

    try {
        const { data: { user } } = await supabaseAuth.auth.getUser();

        if (user) {
            const profile: UserProfile = {
                id: user.id,
                email: user.email || '',
                fullName: user.user_metadata?.full_name || localProfile?.fullName,
                role: user.user_metadata?.role || localProfile?.role,
                avatarUrl: user.user_metadata?.avatar_url || localProfile?.avatarUrl,
                walletAddress: user.user_metadata?.wallet_address || localProfile?.walletAddress,
                brandId: user.user_metadata?.brand_id || localProfile?.brandId,
                createdAt: new Date(user.created_at).getTime(),
                updatedAt: Date.now(),
            };
            saveUserProfile(profile);
            return profile;
        }

        return localProfile;
    } catch (e) {
        console.warn('Failed to get current user:', e);
        return localProfile;
    }
};

// ============================================
// CHECK AUTH STATE
// ============================================

export const isAuthenticated = (): boolean => {
    const profile = loadUserProfile();
    return !!profile && !!profile.email;
};

export const getAuthState = async (): Promise<AuthState> => {
    const user = await getCurrentUser();
    return {
        user,
        isAuthenticated: !!user,
        isLoading: false,
    };
};

// ============================================
// UPDATE USER PROFILE
// ============================================

export const updateUserProfile = async (updates: Partial<UserProfile>): Promise<{ error: string | null }> => {
    try {
        const existing = loadUserProfile();
        if (!existing) {
            return { error: 'No user profile found' };
        }

        const updatedProfile: UserProfile = {
            ...existing,
            ...updates,
            updatedAt: Date.now(),
        };
        saveUserProfile(updatedProfile);

        // Sync to Supabase if configured
        if (supabaseAuth) {
            const { error } = await supabaseAuth.auth.updateUser({
                data: {
                    full_name: updatedProfile.fullName,
                    role: updatedProfile.role,
                    avatar_url: updatedProfile.avatarUrl,
                    wallet_address: updatedProfile.walletAddress,
                    brand_id: updatedProfile.brandId,
                }
            });
            if (error) {
                console.warn('Failed to sync profile to Supabase:', error);
            }
        }

        return { error: null };
    } catch (e: any) {
        console.error('Failed to update profile:', e);
        return { error: e.message };
    }
};

// ============================================
// CREATE USER PROFILE (for onboarding flow)
// ============================================

export const createUserProfile = async (
    profileData: Partial<UserProfile>
): Promise<{ profile: UserProfile | null; error: string | null }> => {
    try {
        const existing = loadUserProfile();
        if (!existing) {
            return { profile: null, error: 'No authenticated user found. Please sign in first.' };
        }

        const updatedProfile: UserProfile = {
            ...existing,
            ...profileData,
            updatedAt: Date.now(),
        };
        saveUserProfile(updatedProfile);

        // Sync to Supabase if configured
        if (supabaseAuth) {
            await supabaseAuth.auth.updateUser({
                data: {
                    full_name: updatedProfile.fullName,
                    role: updatedProfile.role,
                    avatar_url: updatedProfile.avatarUrl,
                    wallet_address: updatedProfile.walletAddress,
                    brand_id: updatedProfile.brandId,
                }
            });
        }

        return { profile: updatedProfile, error: null };
    } catch (e: any) {
        console.error('Failed to create user profile:', e);
        return { profile: null, error: e.message };
    }
};

// ============================================
// LINK BRAND TO USER
// ============================================

export const linkBrandToUser = async (brandId: string): Promise<{ error: string | null }> => {
    const profile = loadUserProfile();
    if (!profile) {
        return { error: 'No user logged in' };
    }

    return updateUserProfile({ brandId });
};

// ============================================
// CONNECT WALLET
// ============================================

export const connectWallet = async (): Promise<{ address: string | null; error: string | null }> => {
    try {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            const accounts = await (window as any).ethereum.request({
                method: 'eth_requestAccounts',
            });

            if (accounts && accounts.length > 0) {
                const address = accounts[0];
                await updateUserProfile({ walletAddress: address });
                return { address, error: null };
            }
            return { address: null, error: 'No accounts found' };
        }
        return { address: null, error: 'No Web3 wallet detected. Please install MetaMask.' };
    } catch (e: any) {
        console.error('Wallet connection failed:', e);
        return { address: null, error: e.message };
    }
};

// ============================================
// AUTH STATE LISTENER
// ============================================

export const onAuthStateChange = (callback: (user: UserProfile | null) => void) => {
    // Listen for local events
    const handleProfileUpdate = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        callback(detail);
    };

    const handleSignOut = () => {
        callback(null);
    };

    window.addEventListener('defia:user-profile-updated', handleProfileUpdate);
    window.addEventListener('defia:user-signed-out', handleSignOut);

    // Listen for Supabase auth changes
    let unsubscribe: (() => void) | null = null;
    if (supabaseAuth) {
        const { data } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const profile = await getCurrentUser();
                callback(profile);
            } else if (event === 'SIGNED_OUT') {
                callback(null);
            }
        });
        unsubscribe = data.subscription.unsubscribe;
    }

    // Return cleanup function
    return () => {
        window.removeEventListener('defia:user-profile-updated', handleProfileUpdate);
        window.removeEventListener('defia:user-signed-out', handleSignOut);
        if (unsubscribe) unsubscribe();
    };
};

// ============================================
// PASSWORD RESET
// ============================================

export const sendPasswordReset = async (email: string): Promise<{ error: string | null }> => {
    if (!supabaseAuth) {
        return { error: 'Password reset not available in offline mode' };
    }

    try {
        const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
            return { error: error.message };
        }
        return { error: null };
    } catch (e: any) {
        return { error: e.message };
    }
};

export { supabaseAuth };
