const { body, param, validationResult } = require('express-validator');
const xss = require('xss');

// Walidacja sumy kontrolnej NIP
const validateNipChecksum = (nip) => {
  // Usuń wszystkie znaki oprócz cyfr
  const cleanNip = nip.replace(/[^0-9]/g, '');

  if (cleanNip.length !== 10) {
    return false;
  }

  // Wagi dla pozycji 1-9
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];

  // Oblicz sumę kontrolną
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanNip[i]) * weights[i];
  }

  // Cyfra kontrolna (ostatnia) = suma % 11
  const checkDigit = sum % 11;

  // Jeśli reszta = 10, NIP jest nieprawidłowy
  if (checkDigit === 10) {
    return false;
  }

  // Porównaj z ostatnią cyfrą NIP
  return checkDigit === parseInt(cleanNip[9]);
};

// Middleware do sanityzacji XSS dla wszystkich pól tekstowych w body
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    const sanitizeValue = (value) => {
      if (typeof value === 'string') {
        return xss(value.trim());
      }
      if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      }
      if (typeof value === 'object' && value !== null) {
        const sanitized = {};
        for (const key in value) {
          sanitized[key] = sanitizeValue(value[key]);
        }
        return sanitized;
      }
      return value;
    };

    for (const key in req.body) {
      req.body[key] = sanitizeValue(req.body[key]);
    }
  }
  next();
};

// Middleware do obsługi błędów walidacji
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Błąd walidacji',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Walidatory dla auth
const loginValidation = [
  body('email')
    .isEmail().withMessage('Podaj prawidłowy adres email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Hasło jest wymagane')
    .isLength({ min: 1 }).withMessage('Hasło jest wymagane'),
  handleValidationErrors
];

const activateValidation = [
  body('token')
    .notEmpty().withMessage('Token jest wymagany'),
  body('password')
    .isLength({ min: 6 }).withMessage('Hasło musi mieć minimum 6 znaków'),
  handleValidationErrors
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Aktualne hasło jest wymagane'),
  body('newPassword')
    .isLength({ min: 6 }).withMessage('Nowe hasło musi mieć minimum 6 znaków'),
  handleValidationErrors
];

// Walidatory dla materiałów
const categoryValidation = [
  body('name')
    .notEmpty().withMessage('Nazwa kategorii jest wymagana')
    .isLength({ min: 2, max: 100 }).withMessage('Nazwa musi mieć 2-100 znaków'),
  body('icon')
    .optional()
    .isLength({ max: 10 }).withMessage('Ikona może mieć max 10 znaków'),
  handleValidationErrors
];

const materialValidation = [
  body('name')
    .notEmpty().withMessage('Nazwa materiału jest wymagana')
    .isLength({ min: 2, max: 200 }).withMessage('Nazwa musi mieć 2-200 znaków'),
  body('category_id')
    .notEmpty().withMessage('Kategoria jest wymagana')
    .matches(/^cat-[a-z0-9]+$/i).withMessage('Nieprawidłowy format identyfikatora kategorii'),
  body('unit')
    .optional()
    .isLength({ max: 20 }).withMessage('Jednostka może mieć max 20 znaków'),
  body('description')
    .optional()
    .isLength({ max: 1000 }).withMessage('Opis może mieć max 1000 znaków'),
  handleValidationErrors
];

// Walidatory dla dostawców
const supplierValidation = [
  body('company_name')
    .notEmpty().withMessage('Nazwa firmy jest wymagana')
    .isLength({ min: 2, max: 200 }).withMessage('Nazwa firmy musi mieć 2-200 znaków'),
  body('nip')
    .optional({ values: 'falsy' })
    .matches(/^[0-9]{10}$/).withMessage('NIP musi składać się z 10 cyfr')
    .custom((value) => {
      if (!validateNipChecksum(value)) {
        throw new Error('Nieprawidłowa suma kontrolna NIP');
      }
      return true;
    }),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail().withMessage('Podaj prawidłowy adres email'),
  body('phone')
    .optional({ values: 'falsy' })
    .isLength({ max: 20 }).withMessage('Telefon może mieć max 20 znaków'),
  body('city')
    .optional({ values: 'falsy' })
    .isLength({ max: 100 }).withMessage('Miasto może mieć max 100 znaków'),
  body('address')
    .optional({ values: 'falsy' })
    .isLength({ max: 300 }).withMessage('Adres może mieć max 300 znaków'),
  handleValidationErrors
];

const nipParamValidation = [
  param('nip')
    .matches(/^[0-9]{10}$/).withMessage('NIP musi składać się z 10 cyfr')
    .custom((value) => {
      if (!validateNipChecksum(value)) {
        throw new Error('Nieprawidłowa suma kontrolna NIP');
      }
      return true;
    }),
  handleValidationErrors
];

// Walidatory dla aukcji
const auctionValidation = [
  body('title')
    .notEmpty().withMessage('Tytuł aukcji jest wymagany')
    .isLength({ min: 3, max: 300 }).withMessage('Tytuł musi mieć 3-300 znaków'),
  body('quantity')
    .notEmpty().withMessage('Ilość jest wymagana')
    .isFloat({ min: 0.01 }).withMessage('Ilość musi być większa od 0'),
  body('duration_minutes')
    .optional()
    .isInt({ min: 1, max: 1440 }).withMessage('Czas trwania musi być między 1 a 1440 minut'),
  body('supplier_ids')
    .optional()
    .isArray().withMessage('Lista dostawców musi być tablicą')
    .custom((value) => {
      if (value && value.length > 0) {
        const invalidIds = value.filter(id => !/^sup-[a-z0-9]+$/i.test(id));
        if (invalidIds.length > 0) {
          throw new Error(`Nieprawidłowy format identyfikatora dostawcy: ${invalidIds.join(', ')}`);
        }
      }
      return true;
    }),
  body('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('Opis może mieć max 2000 znaków'),
  handleValidationErrors
];

const bidValidation = [
  body('amount')
    .notEmpty().withMessage('Kwota oferty jest wymagana')
    .isFloat({ min: 0.01 }).withMessage('Kwota musi być większa od 0'),
  handleValidationErrors
];

const inviteValidation = [
  body('supplier_ids')
    .isArray({ min: 1 }).withMessage('Wybierz przynajmniej jednego dostawcę'),
  handleValidationErrors
];

module.exports = {
  sanitizeBody,
  handleValidationErrors,
  loginValidation,
  activateValidation,
  changePasswordValidation,
  categoryValidation,
  materialValidation,
  supplierValidation,
  nipParamValidation,
  auctionValidation,
  bidValidation,
  inviteValidation
};
