import { useState } from 'react';
import { getLiveToken, setLiveToken, clearLiveToken, liveAuth, LiveApiError } from './liveApi';

/** Shared real staff-auth session for every "-live" admin page (see
 * SubscriptionPlansLive.tsx, the first one) — factored out once a second
 * live page needed the exact same login/2FA boilerplate. One real JWT
 * (`pba_live_staff_token`) shared across all live pages, separate from the
 * mock `pba_session`. */
export function useLiveSession() {
  const [token, setToken] = useState(getLiveToken());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffId, setStaffId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [staffName, setStaffName] = useState('');

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    try {
      const res = await liveAuth.login(email.trim(), password);
      if (res.requires2fa && res.staffId) {
        setStaffId(res.staffId);
        return;
      }
      if (res.token) {
        setLiveToken(res.token);
        setToken(res.token);
        setStaffName(res.staff?.name ?? email);
      }
    } catch (e) {
      setLoginErr(e instanceof LiveApiError ? e.message : 'Login failed');
    }
  };

  const submit2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    try {
      const res = await liveAuth.verify2fa(staffId!, code.trim());
      setLiveToken(res.token);
      setToken(res.token);
      setStaffName(res.staff?.name ?? email);
    } catch (e) {
      setLoginErr(e instanceof LiveApiError ? e.message : 'Invalid code');
    }
  };

  const logout = () => {
    clearLiveToken();
    setToken(null);
    setStaffName('');
  };

  return { token, email, setEmail, password, setPassword, staffId, code, setCode, loginErr, staffName, submitLogin, submit2fa, logout };
}
