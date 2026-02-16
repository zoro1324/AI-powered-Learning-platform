import { useAppDispatch, useAppSelector } from '../store';
import { login, register, logout, clearError, fetchUserProfile, updateUserProfile, updateLearningProfile } from '../store/slices/authSlice';
import type { LoginCredentials, RegisterData, User, LearningProfile } from '../types/api';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, loading, error } = useAppSelector((state) => state.auth);

  const handleLogin = async (credentials: LoginCredentials) => {
    const result = await dispatch(login(credentials));
    return result;
  };

  const handleRegister = async (data: RegisterData) => {
    const result = await dispatch(register(data));
    return result;
  };

  const handleLogout = async () => {
    await dispatch(logout());
  };

  const refreshProfile = async () => {
    await dispatch(fetchUserProfile());
  };

  const updateProfile = async (data: Partial<User>) => {
    const result = await dispatch(updateUserProfile(data));
    return result;
  };

  const updatePreferences = async (data: Partial<LearningProfile>) => {
    const result = await dispatch(updateLearningProfile(data));
    return result;
  };

  const clearAuthError = () => {
    dispatch(clearError());
  };

  return {
    user,
    isAuthenticated,
    loading,
    error,
    handleLogin,
    handleRegister,
    handleLogout,
    refreshProfile,
    updateProfile,
    updatePreferences,
    clearAuthError,
  };
};
