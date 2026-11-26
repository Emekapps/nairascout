'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePasswordLocally,
} from '@/lib/auth/password-policy';

interface PasswordStrengthInputProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  email?: string;
  username?: string;
  displayName?: string;
  helperText?: string;
}

// NS-AUT-001: NIST SP 800-63B-4 15-character passphrase input with live character counter & strength meter
export function PasswordStrengthInput({
  id,
  label = 'Password (minimum 15 characters)',
  value,
  onChange,
  placeholder = 'Use a memorable passphrase (15+ characters, spaces allowed)',
  autoFocus = false,
  email,
  username,
  displayName,
  helperText = 'Minimum 15 characters (up to 128). Spaces and Unicode characters are allowed; no forced symbol rules.',
}: PasswordStrengthInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const assessment = useMemo(
    () => validatePasswordLocally(value, { email, username, displayName }),
    [value, email, username, displayName]
  );

  const barColor =
    assessment.strengthLabel === 'Very Strong'
      ? 'bg-emerald-500'
      : assessment.strengthLabel === 'Strong'
        ? 'bg-emerald-500/80'
        : assessment.strengthLabel === 'Weak'
          ? 'bg-amber-500'
          : 'bg-destructive';

  const labelTone =
    assessment.strengthLabel === 'Very Strong' || assessment.strengthLabel === 'Strong'
      ? 'text-success'
      : assessment.strengthLabel === 'Weak'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-destructive';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <span
          className={`font-numeric text-[11px] font-semibold tabular-nums ${
            assessment.length >= MIN_PASSWORD_LENGTH ? 'text-success' : 'text-muted-foreground'
          }`}
        >
          {assessment.length} / {MIN_PASSWORD_LENGTH} min chars
        </span>
      </div>

      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          autoFocus={autoFocus}
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={MAX_PASSWORD_LENGTH}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${barColor}`}
            style={{ width: `${value.length === 0 ? 0 : Math.max(10, assessment.strengthScore)}%` }}
          />
        </div>
        {value.length > 0 && (
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className={`inline-flex items-center gap-1 font-semibold ${labelTone}`}>
              {assessment.valid ? (
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {assessment.strengthLabel}
            </span>
            {assessment.errors[0] && (
              <span className="text-destructive text-right">{assessment.errors[0]}</span>
            )}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      </div>
    </div>
  );
}
