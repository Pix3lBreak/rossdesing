import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../config/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  adminUnlocked: boolean;
  authError: string | null;
  verifyAdminCredentials: (username: string, password: string) => boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const ADMIN_SESSION_KEY = 'psp_admin_unlocked_v1';
const ADMIN_EXPECTED_USER = 'ADMIN';
const ADMIN_EXPECTED_PASS = 'adminRF2026';

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);
      if (!currentUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const isOwnerEmail =
          currentUser.emailVerified &&
          currentUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

        const adminPath = `admins/${currentUser.uid}`;
        const adminRef = doc(db, 'admins', currentUser.uid);

        if (isOwnerEmail) {
          let snapExists = false;
          try {
            const snap = await getDoc(adminRef);
            snapExists = snap.exists();
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, adminPath);
          }
          if (!snapExists) {
            try {
              await setDoc(adminRef, {
                uid: currentUser.uid,
                email: currentUser.email || BOOTSTRAPPED_ADMIN_EMAIL,
                displayName: (currentUser.displayName || 'Administrador').slice(0, 120),
                role: 'owner',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, adminPath);
            }
          }
          setIsAdmin(true);
        } else if (currentUser.emailVerified) {
          try {
            const adminSnap = await getDoc(adminRef);
            setIsAdmin(adminSnap.exists());
            if (!adminSnap.exists()) {
              setAuthError('Acceso denegado: tu cuenta de Google no está autorizada como administrador.');
            }
          } catch (err) {
            setIsAdmin(false);
            setAuthError('Acceso denegado: tu cuenta no tiene permisos de administrador.');
            handleFirestoreError(err, OperationType.GET, adminPath);
          }
        } else {
          setIsAdmin(false);
          setAuthError('Se requiere una cuenta de Google con correo verificado.');
        }
      } catch (err) {
        console.error('Error verifying admin privileges:', err);
        setIsAdmin(false);
        setAuthError(
          err instanceof Error
            ? err.message
            : 'No se pudieron verificar los permisos de administrador en Firebase.'
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const verifyAdminCredentials = (username: string, password: string): boolean => {
    const valid =
      username.trim().toUpperCase() === ADMIN_EXPECTED_USER &&
      password === ADMIN_EXPECTED_PASS;
    if (valid) {
      setAdminUnlocked(true);
      setAuthError(null);
      try {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      } catch {
        // Ignore sessionStorage errors in restricted frames
      }
      return true;
    }
    setAuthError('Usuario o contraseña incorrectos. Verifica tus credenciales de administrador.');
    return false;
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión.';
      setAuthError(msg);
      throw err;
    }
  };

  const logout = async () => {
    setAdminUnlocked(false);
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // Ignore
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        adminUnlocked,
        authError,
        verifyAdminCredentials,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
