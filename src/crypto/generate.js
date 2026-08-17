const crypto = require('node:crypto');

const KINDS = ['password', 'api_key', 'token'];

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*_-+=?';

const AMBIGUOUS_UPPER = 'IO';
const AMBIGUOUS_LOWER = 'l';
const AMBIGUOUS_DIGITS = '01';

const DEFAULTS = {
  password: { length: 20, symbols: true },
  api_key: { length: 32, symbols: false },
  token: { length: 48, symbols: false },
};

function charset({ uppercase, lowercase, digits, symbols, excludeAmbiguous }) {
  let upper = uppercase ? UPPER : '';
  let lower = lowercase ? LOWER : '';
  let digit = digits ? DIGITS : '';
  const symbol = symbols ? SYMBOLS : '';

  if (!excludeAmbiguous) {
    if (uppercase) upper += AMBIGUOUS_UPPER;
    if (lowercase) lower += AMBIGUOUS_LOWER;
    if (digits) digit += AMBIGUOUS_DIGITS;
  }

  return { upper, lower, digit, symbol };
}

function pick(set) {
  return set[crypto.randomInt(set.length)];
}

function shuffle(chars) {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

function generateSecret(options = {}) {
  const kind = options.kind || 'password';
  if (!KINDS.includes(kind)) {
    return { error: `kind debe ser uno de: ${KINDS.join(', ')}` };
  }

  const defaults = DEFAULTS[kind];
  const length = options.length === undefined ? defaults.length : Number(options.length);
  if (!Number.isInteger(length) || length < 12 || length > 128) {
    return { error: 'length debe ser un entero entre 12 y 128' };
  }

  const uppercase = options.uppercase !== false;
  const lowercase = options.lowercase !== false;
  const digits = options.digits !== false;
  const symbols = options.symbols === undefined ? defaults.symbols : Boolean(options.symbols);
  const excludeAmbiguous = options.excludeAmbiguous !== false;

  const sets = charset({ uppercase, lowercase, digits, symbols, excludeAmbiguous });
  const pools = [sets.upper, sets.lower, sets.digit, sets.symbol].filter(Boolean);
  if (!pools.length) {
    return { error: 'al menos un juego de caracteres debe estar activo' };
  }
  if (length < pools.length) {
    return { error: `length debe ser al menos ${pools.length} para cubrir los juegos activos` };
  }

  const required = pools.map((set) => pick(set));
  const alphabet = pools.join('');
  const rest = [];
  for (let i = required.length; i < length; i += 1) {
    rest.push(pick(alphabet));
  }

  const value = shuffle(required.concat(rest)).join('');
  return {
    kind,
    length: value.length,
    value,
    options: { uppercase, lowercase, digits, symbols, excludeAmbiguous },
  };
}

module.exports = {
  generateSecret,
  KINDS,
};
