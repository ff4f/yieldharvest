const jwt = require('jsonwebtoken');

// Use the same secret as in your backend
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-yieldharvest-demo';

// Create a test user payload
const payload = {
  userId: 'test-user-123',
  accountId: 'test-account-123',
  role: 'SUPPLIER',
  email: 'test@example.com'
};

// Generate token with 24h expiration and required issuer/audience
const token = jwt.sign(payload, JWT_SECRET, { 
  expiresIn: '24h',
  issuer: 'yieldharvest',
  audience: 'yieldharvest-users'
});

console.log('Test JWT Token:');
console.log(token);
console.log('\nUse this token in your API requests:');
console.log(`Authorization: Bearer ${token}`);