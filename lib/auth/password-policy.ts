// NS-AUT-001: NIST SP 800-63B-4 15-character password & compromised-password validation

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;

export interface PasswordValidationContext {
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
}

export interface PasswordValidationResult {
  valid: boolean;
  length: number;
  strengthLabel: 'Too Short' | 'Weak' | 'Strong' | 'Very Strong';
  strengthScore: number; // 0..100
  errors: string[];
  compromisedCheckStatus: 'skipped' | 'clean' | 'compromised' | 'unavailable';
}

const COMMON_COMPROMISED_PASSWORDS = new Set<string>([
  'password1234567',
  'password12345678',
  'passwordpassword',
  '123456789012345',
  '1234567890123456',
  '000000000000000',
  '111111111111111',
  'qwertyuiopasdfg',
  'qwerty123456789',
  'asdfghjklzxcvbn',
  'letmein12345678',
  'welcome12345678',
  'admin1234567890',
  'nairascout12345',
  'nairascoutadmin',
  'nigeria12345678',
  'iloveyounigeria',
  'correcthorsebatterystaple',
  'thequickbrownfox',
  'changeme1234567',
  'passphrase12345',
]);

function normalizeForComparison(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function hasSequentialPattern(password: string): boolean {
  const lower = password.toLowerCase();
  const sequences = [
    '0123456789012345',
    '9876543210987654',
    'abcdefghijklmnopqrstuvwxyz',
    'qwertyuiopasdfghjklzxcvbnm',
  ];
  for (const seq of sequences) {
    if (lower.length >= 15 && seq.includes(lower)) {
      return true;
    }
  }
  // All identical characters (e.g. "aaaaaaaaaaaaaaa")
  const chars = Array.from(password);
  if (chars.length >= MIN_PASSWORD_LENGTH && new Set(chars).size <= 2) {
    return true;
  }
  return false;
}

export function validatePasswordLocally(
  password: string,
  context?: PasswordValidationContext
): PasswordValidationResult {
  const errors: string[] = [];
  const length = Array.from(password).length; // Unicode code-point aware

  if (length < MIN_PASSWORD_LENGTH) {
    errors.push(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters (${length}/${MIN_PASSWORD_LENGTH}).`
    );
  }

  if (length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`);
  }

  const normalized = normalizeForComparison(password);
  if (COMMON_COMPROMISED_PASSWORDS.has(normalized) || hasSequentialPattern(password)) {
    errors.push(
      'This password is too common or predictable. Choose a longer, unique passphrase.'
    );
  }

  const contextTokens: string[] = [];
  if (context?.email) {
    const trimmedEmail = context.email.trim().toLowerCase();
    if (trimmedEmail.length >= 3) contextTokens.push(trimmedEmail);
    const localPart = trimmedEmail.split('@')[0];
    if (localPart && localPart.length >= 3) contextTokens.push(localPart);
  }
  if (context?.username && context.username.trim().length >= 3) {
    contextTokens.push(context.username.trim().toLowerCase());
  }
  if (context?.displayName) {
    for (const part of context.displayName.trim().toLowerCase().split(/\s+/)) {
      if (part.length >= 4) contextTokens.push(part);
    }
  }

  const lowerPass = password.toLowerCase();
  for (const token of contextTokens) {
    if (token && lowerPass.includes(token)) {
      errors.push(
        'Password must not contain your email address, username, or name.'
      );
      break;
    }
  }

  const uniqueChars = new Set(Array.from(password)).size;
  let strengthScore = Math.min(100, Math.round((length / 24) * 70 + (uniqueChars / 16) * 30));
  if (length < MIN_PASSWORD_LENGTH) {
    strengthScore = Math.min(35, Math.round((length / MIN_PASSWORD_LENGTH) * 35));
  } else if (errors.length > 0) {
    strengthScore = Math.min(45, strengthScore);
  }

  let strengthLabel: PasswordValidationResult['strengthLabel'] = 'Strong';
  if (length < MIN_PASSWORD_LENGTH) {
    strengthLabel = 'Too Short';
  } else if (errors.length > 0 || strengthScore < 55) {
    strengthLabel = 'Weak';
  } else if (length >= 20 && uniqueChars >= 10) {
    strengthLabel = 'Very Strong';
  }

  return {
    valid: errors.length === 0,
    length,
    strengthLabel,
    strengthScore,
    errors,
    compromisedCheckStatus: 'skipped',
  };
}

async function sha1HexUpper(input: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await subtle.digest('SHA-1', encoded);
    const bytes = new Uint8Array(hashBuffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  } catch {
    return null;
  }
}

// NS-AUT-001: Optional HaveIBeenPwned k-anonymity range check with non-blocking offline fallback
export async function checkPwnedPasswordRange(
  password: string
): Promise<'clean' | 'compromised' | 'unavailable'> {
  const hash = await sha1HexUpper(password);
  if (!hash || hash.length !== 40) {
    return 'unavailable';
  }

  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: {
        'Add-Padding': 'true',
      },
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    });
    if (!res.ok) return 'unavailable';
    const body = await res.text();
    const lines = body.split(/\r?\n/);
    for (const line of lines) {
      const [candidateSuffix, countStr] = line.split(':');
      if (candidateSuffix?.trim().toUpperCase() === suffix && Number(countStr || 0) > 0) {
        return 'compromised';
      }
    }
    return 'clean';
  } catch {
    return 'unavailable';
  }
}

export async function validateNairaScoutPassword(
  password: string,
  context?: PasswordValidationContext
): Promise<PasswordValidationResult> {
  const local = validatePasswordLocally(password, context);
  if (!local.valid) {
    return local;
  }

  const pwnedStatus = await checkPwnedPasswordRange(password);
  if (pwnedStatus === 'compromised') {
    return {
      ...local,
      valid: false,
      strengthLabel: 'Weak',
      strengthScore: Math.min(local.strengthScore, 40),
      errors: [
        ...local.errors,
        'This password appears in known public data breaches. Please choose a unique passphrase.',
      ],
      compromisedCheckStatus: 'compromised',
    };
  }

  return {
    ...local,
    compromisedCheckStatus: pwnedStatus,
  };
}
