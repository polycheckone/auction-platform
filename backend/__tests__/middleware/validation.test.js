const { validationResult } = require('express-validator');

// Import validators
const {
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
} = require('../../middleware/validation');

// Helper to run express-validator middleware chain
const runValidation = async (validations, req) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };

  // Track if response was sent
  let responseSent = false;
  const originalJson = res.json;
  res.json = jest.fn((...args) => {
    responseSent = true;
    return originalJson.apply(res, args);
  });

  for (const validation of validations) {
    if (responseSent) break;

    await new Promise((resolve) => {
      // The middleware either calls next() or sends response
      const nextCalled = validation(req, res, resolve);

      // If it returns a Promise (express-validator chains), wait for it
      if (nextCalled && typeof nextCalled.then === 'function') {
        nextCalled.then(resolve).catch(resolve);
      }

      // If response was sent, resolve immediately
      if (responseSent) {
        resolve();
      }
    });
  }

  return { req, res };
};

// Helper to create mock request
const createMockRequest = (body = {}, params = {}) => ({
  body,
  params,
  cookies: {}
});

// ============================================
// loginValidation tests
// ============================================
describe('loginValidation', () => {
  test('valid email and password passes validation', async () => {
    const req = createMockRequest({
      email: 'test@example.com',
      password: 'password123'
    });

    const { res } = await runValidation(loginValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('invalid email format fails validation', async () => {
    const req = createMockRequest({
      email: 'invalid-email',
      password: 'password123'
    });

    const { res } = await runValidation(loginValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Błąd walidacji',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'email' })
        ])
      })
    );
  });

  test('empty password fails validation', async () => {
    const req = createMockRequest({
      email: 'test@example.com',
      password: ''
    });

    const { res } = await runValidation(loginValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'password' })
        ])
      })
    );
  });

  test('missing email fails validation', async () => {
    const req = createMockRequest({
      password: 'password123'
    });

    const { res } = await runValidation(loginValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ============================================
// activateValidation tests
// ============================================
describe('activateValidation', () => {
  test('valid token and password passes validation', async () => {
    const req = createMockRequest({
      token: 'valid-activation-token',
      password: 'password123'
    });

    const { res } = await runValidation(activateValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('missing token fails validation', async () => {
    const req = createMockRequest({
      token: '',
      password: 'password123'
    });

    const { res } = await runValidation(activateValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'token' })
        ])
      })
    );
  });

  test('password shorter than 6 characters fails validation', async () => {
    const req = createMockRequest({
      token: 'valid-token',
      password: '12345'
    });

    const { res } = await runValidation(activateValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: 'Hasło musi mieć minimum 6 znaków'
          })
        ])
      })
    );
  });

  test('password with exactly 6 characters passes validation', async () => {
    const req = createMockRequest({
      token: 'valid-token',
      password: '123456'
    });

    const { res } = await runValidation(activateValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ============================================
// changePasswordValidation tests
// ============================================
describe('changePasswordValidation', () => {
  test('valid current and new password passes validation', async () => {
    const req = createMockRequest({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123'
    });

    const { res } = await runValidation(changePasswordValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('missing current password fails validation', async () => {
    const req = createMockRequest({
      currentPassword: '',
      newPassword: 'newPassword123'
    });

    const { res } = await runValidation(changePasswordValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'currentPassword' })
        ])
      })
    );
  });

  test('new password shorter than 6 characters fails validation', async () => {
    const req = createMockRequest({
      currentPassword: 'oldPassword123',
      newPassword: '12345'
    });

    const { res } = await runValidation(changePasswordValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'newPassword' })
        ])
      })
    );
  });
});

// ============================================
// categoryValidation tests
// ============================================
describe('categoryValidation', () => {
  test('valid category name passes validation', async () => {
    const req = createMockRequest({
      name: 'Electronics'
    });

    const { res } = await runValidation(categoryValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('category name with 2 characters passes validation', async () => {
    const req = createMockRequest({
      name: 'AB'
    });

    const { res } = await runValidation(categoryValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('category name with 100 characters passes validation', async () => {
    const req = createMockRequest({
      name: 'A'.repeat(100)
    });

    const { res } = await runValidation(categoryValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('category name with 1 character fails validation', async () => {
    const req = createMockRequest({
      name: 'A'
    });

    const { res } = await runValidation(categoryValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: 'Nazwa musi mieć 2-100 znaków'
          })
        ])
      })
    );
  });

  test('category name with 101 characters fails validation', async () => {
    const req = createMockRequest({
      name: 'A'.repeat(101)
    });

    const { res } = await runValidation(categoryValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('icon with 10 characters passes validation', async () => {
    const req = createMockRequest({
      name: 'Electronics',
      icon: '1234567890'
    });

    const { res } = await runValidation(categoryValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('icon with 11 characters fails validation', async () => {
    const req = createMockRequest({
      name: 'Electronics',
      icon: '12345678901'
    });

    const { res } = await runValidation(categoryValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'icon' })
        ])
      })
    );
  });

  test('optional icon field is not required', async () => {
    const req = createMockRequest({
      name: 'Electronics'
    });

    const { res } = await runValidation(categoryValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ============================================
// materialValidation tests
// ============================================
describe('materialValidation', () => {
  test('valid material passes validation', async () => {
    const req = createMockRequest({
      name: 'Steel Pipe',
      category_id: 'cat-abc123'
    });

    const { res } = await runValidation(materialValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('material name with 2 characters passes validation', async () => {
    const req = createMockRequest({
      name: 'AB',
      category_id: 'cat-abc123'
    });

    const { res } = await runValidation(materialValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('material name with 200 characters passes validation', async () => {
    const req = createMockRequest({
      name: 'A'.repeat(200),
      category_id: 'cat-abc123'
    });

    const { res } = await runValidation(materialValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('material name shorter than 2 characters fails validation', async () => {
    const req = createMockRequest({
      name: 'A',
      category_id: 'cat-abc123'
    });

    const { res } = await runValidation(materialValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('material name longer than 200 characters fails validation', async () => {
    const req = createMockRequest({
      name: 'A'.repeat(201),
      category_id: 'cat-abc123'
    });

    const { res } = await runValidation(materialValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('valid category_id format passes validation', async () => {
    const req = createMockRequest({
      name: 'Steel Pipe',
      category_id: 'cat-xyz789'
    });

    const { res } = await runValidation(materialValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('invalid category_id format fails validation', async () => {
    const req = createMockRequest({
      name: 'Steel Pipe',
      category_id: 'invalid-format'
    });

    const { res } = await runValidation(materialValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'category_id',
            message: 'Nieprawidłowy format identyfikatora kategorii'
          })
        ])
      })
    );
  });

  test('missing category_id fails validation', async () => {
    const req = createMockRequest({
      name: 'Steel Pipe'
    });

    const { res } = await runValidation(materialValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ============================================
// supplierValidation tests
// ============================================
describe('supplierValidation', () => {
  test('valid supplier passes validation', async () => {
    const req = createMockRequest({
      company_name: 'ACME Corporation'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('company name with 2 characters passes validation', async () => {
    const req = createMockRequest({
      company_name: 'AB'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('company name with 200 characters passes validation', async () => {
    const req = createMockRequest({
      company_name: 'A'.repeat(200)
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('company name shorter than 2 characters fails validation', async () => {
    const req = createMockRequest({
      company_name: 'A'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'company_name',
            message: 'Nazwa firmy musi mieć 2-200 znaków'
          })
        ])
      })
    );
  });

  test('valid NIP 7740001454 passes validation (correct checksum)', async () => {
    const req = createMockRequest({
      company_name: 'ACME Corporation',
      nip: '7740001454'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('valid NIP 5260250995 passes validation', async () => {
    const req = createMockRequest({
      company_name: 'Test Company',
      nip: '5260250995'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('invalid NIP 1234567890 fails validation (bad checksum)', async () => {
    const req = createMockRequest({
      company_name: 'ACME Corporation',
      nip: '1234567890'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'nip',
            message: 'Nieprawidłowa suma kontrolna NIP'
          })
        ])
      })
    );
  });

  test('NIP too short fails validation', async () => {
    const req = createMockRequest({
      company_name: 'ACME Corporation',
      nip: '123'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'nip',
            message: 'NIP musi składać się z 10 cyfr'
          })
        ])
      })
    );
  });

  test('NIP with non-numeric characters fails validation', async () => {
    const req = createMockRequest({
      company_name: 'ACME Corporation',
      nip: '123456789A'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('valid email passes validation', async () => {
    const req = createMockRequest({
      company_name: 'ACME Corporation',
      email: 'contact@acme.com'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('invalid email fails validation', async () => {
    const req = createMockRequest({
      company_name: 'ACME Corporation',
      email: 'invalid-email'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'email' })
        ])
      })
    );
  });

  test('optional fields are not required', async () => {
    const req = createMockRequest({
      company_name: 'ACME Corporation'
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('empty NIP is allowed (optional field)', async () => {
    const req = createMockRequest({
      company_name: 'ACME Corporation',
      nip: ''
    });

    const { res } = await runValidation(supplierValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ============================================
// nipParamValidation tests
// ============================================
describe('nipParamValidation', () => {
  test('valid NIP 7740001454 passes validation', async () => {
    const req = createMockRequest({}, { nip: '7740001454' });

    const { res } = await runValidation(nipParamValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('valid NIP 5260250995 passes validation', async () => {
    const req = createMockRequest({}, { nip: '5260250995' });

    const { res } = await runValidation(nipParamValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('invalid NIP checksum fails validation', async () => {
    const req = createMockRequest({}, { nip: '1234567890' });

    const { res } = await runValidation(nipParamValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'nip',
            message: 'Nieprawidłowa suma kontrolna NIP'
          })
        ])
      })
    );
  });

  test('NIP with 9 digits fails validation', async () => {
    const req = createMockRequest({}, { nip: '123456789' });

    const { res } = await runValidation(nipParamValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'nip',
            message: 'NIP musi składać się z 10 cyfr'
          })
        ])
      })
    );
  });

  test('NIP with 11 digits fails validation', async () => {
    const req = createMockRequest({}, { nip: '12345678901' });

    const { res } = await runValidation(nipParamValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ============================================
// auctionValidation tests
// ============================================
describe('auctionValidation', () => {
  test('valid auction passes validation', async () => {
    const req = createMockRequest({
      title: 'Steel Pipes Auction',
      quantity: 100
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('title with 3 characters passes validation', async () => {
    const req = createMockRequest({
      title: 'ABC',
      quantity: 100
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('title with 300 characters passes validation', async () => {
    const req = createMockRequest({
      title: 'A'.repeat(300),
      quantity: 100
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('title with 2 characters fails validation', async () => {
    const req = createMockRequest({
      title: 'AB',
      quantity: 100
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: 'Tytuł musi mieć 3-300 znaków'
          })
        ])
      })
    );
  });

  test('title with 301 characters fails validation', async () => {
    const req = createMockRequest({
      title: 'A'.repeat(301),
      quantity: 100
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('quantity of 0.01 passes validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: 0.01
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('quantity of 0 fails validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: 0
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'quantity',
            message: 'Ilość musi być większa od 0'
          })
        ])
      })
    );
  });

  test('negative quantity fails validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: -10
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('duration_minutes of 1 passes validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: 100,
      duration_minutes: 1
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('duration_minutes of 1440 passes validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: 100,
      duration_minutes: 1440
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('duration_minutes of 0 fails validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: 100,
      duration_minutes: 0
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'duration_minutes' })
        ])
      })
    );
  });

  test('duration_minutes of 1441 fails validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: 100,
      duration_minutes: 1441
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('valid supplier_ids array passes validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: 100,
      supplier_ids: ['sup-abc123', 'sup-xyz789']
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('invalid supplier_ids format fails validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: 100,
      supplier_ids: ['invalid-format', 'sup-xyz789']
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('supplier_ids as non-array fails validation', async () => {
    const req = createMockRequest({
      title: 'Test Auction',
      quantity: 100,
      supplier_ids: 'not-an-array'
    });

    const { res } = await runValidation(auctionValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ============================================
// bidValidation tests
// ============================================
describe('bidValidation', () => {
  test('valid amount passes validation', async () => {
    const req = createMockRequest({
      amount: 100.50
    });

    const { res } = await runValidation(bidValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('amount of 0.01 passes validation', async () => {
    const req = createMockRequest({
      amount: 0.01
    });

    const { res } = await runValidation(bidValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('amount of 0 fails validation', async () => {
    const req = createMockRequest({
      amount: 0
    });

    const { res } = await runValidation(bidValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'amount',
            message: 'Kwota musi być większa od 0'
          })
        ])
      })
    );
  });

  test('negative amount fails validation', async () => {
    const req = createMockRequest({
      amount: -50
    });

    const { res } = await runValidation(bidValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('missing amount fails validation', async () => {
    const req = createMockRequest({});

    const { res } = await runValidation(bidValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'amount',
            message: 'Kwota oferty jest wymagana'
          })
        ])
      })
    );
  });
});

// ============================================
// inviteValidation tests
// ============================================
describe('inviteValidation', () => {
  test('valid supplier_ids array passes validation', async () => {
    const req = createMockRequest({
      supplier_ids: ['sup-abc123']
    });

    const { res } = await runValidation(inviteValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('multiple supplier_ids passes validation', async () => {
    const req = createMockRequest({
      supplier_ids: ['sup-abc123', 'sup-xyz789', 'sup-def456']
    });

    const { res } = await runValidation(inviteValidation, req);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('empty supplier_ids array fails validation', async () => {
    const req = createMockRequest({
      supplier_ids: []
    });

    const { res } = await runValidation(inviteValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'supplier_ids',
            message: 'Wybierz przynajmniej jednego dostawcę'
          })
        ])
      })
    );
  });

  test('missing supplier_ids fails validation', async () => {
    const req = createMockRequest({});

    const { res } = await runValidation(inviteValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('supplier_ids as string fails validation', async () => {
    const req = createMockRequest({
      supplier_ids: 'sup-abc123'
    });

    const { res } = await runValidation(inviteValidation, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ============================================
// sanitizeBody tests
// ============================================
describe('sanitizeBody', () => {
  test('trims whitespace from string values', () => {
    const req = {
      body: {
        name: '  Test Name  ',
        email: '  test@example.com  '
      }
    };
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(req.body.name).toBe('Test Name');
    expect(req.body.email).toBe('test@example.com');
    expect(next).toHaveBeenCalled();
  });

  test('sanitizes XSS in string values', () => {
    const req = {
      body: {
        name: '<script>alert("XSS")</script>',
        description: '<img src="x" onerror="alert(1)">'
      }
    };
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(req.body.name).not.toContain('<script>');
    expect(req.body.description).not.toContain('onerror');
    expect(next).toHaveBeenCalled();
  });

  test('handles nested objects', () => {
    const req = {
      body: {
        user: {
          name: '  <script>alert(1)</script>  ',
          email: '  test@example.com  '
        }
      }
    };
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(req.body.user.name).not.toContain('<script>');
    expect(req.body.user.email).toBe('test@example.com');
    expect(next).toHaveBeenCalled();
  });

  test('handles arrays', () => {
    const req = {
      body: {
        tags: ['  <script>tag1</script>  ', '  tag2  ']
      }
    };
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(req.body.tags[0]).not.toContain('<script>');
    expect(req.body.tags[1]).toBe('tag2');
    expect(next).toHaveBeenCalled();
  });

  test('preserves numbers', () => {
    const req = {
      body: {
        quantity: 100,
        price: 99.99
      }
    };
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(req.body.quantity).toBe(100);
    expect(req.body.price).toBe(99.99);
    expect(next).toHaveBeenCalled();
  });

  test('handles null values', () => {
    const req = {
      body: {
        name: null,
        value: undefined
      }
    };
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(req.body.name).toBe(null);
    expect(next).toHaveBeenCalled();
  });

  test('handles empty body', () => {
    const req = { body: {} };
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('handles missing body', () => {
    const req = {};
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

// ============================================
// handleValidationErrors tests
// ============================================
describe('handleValidationErrors', () => {
  test('calls next when no errors', async () => {
    const req = createMockRequest({
      email: 'test@example.com',
      password: 'password123'
    });

    // Run through loginValidation without handleValidationErrors
    for (const validation of loginValidation.slice(0, -1)) {
      await new Promise((resolve) => {
        validation(req, {}, resolve);
      });
    }

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    handleValidationErrors(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 400 with proper error format when validation fails', async () => {
    const req = createMockRequest({
      email: 'invalid-email',
      password: ''
    });

    // Run through loginValidation without handleValidationErrors
    for (const validation of loginValidation.slice(0, -1)) {
      await new Promise((resolve) => {
        validation(req, {}, resolve);
      });
    }

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    handleValidationErrors(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Błąd walidacji',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String)
          })
        ])
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
